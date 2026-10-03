import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Murmur's model server, treated as a product dependency.
 *
 * The deck draws from the 30B MoE in llama.cpp, not from Ollama's 8B model,
 * because that MoE's prose is the reason it exists. That moves the model server
 * from a background convenience into the request path: a fresh draw takes
 * minutes, and minutes later is useless if the weights are not on the card when
 * she presses the button.
 *
 * So the boot lives here rather than in the provider. The provider stays a plain
 * HTTP client — it does not know systemd exists, and it still works against a
 * llama-server somebody started by hand. Product logic owns the lifecycle; the
 * model adapter only speaks the protocol. That is the same separation the
 * architecture report insists on between product logic and the model layer.
 *
 * The server is deliberately NOT left running forever. It holds nearly the whole
 * graphics card, and open-webui is a separate user service with its own
 * OLLAMA_KEEP_ALIVE that needs that card too. Every draw rearms a short idle
 * timer, so the weights come off the card a while after she stops painting
 * instead of never coming off at all.
 */

export interface ModelServerStatus {
  /** True when this call had to start the server; false when it was already up. */
  started: boolean;
  /** How long the caller waited for the weights to land. 0 when already up. */
  waitedMs: number;
  /** The systemd user unit the boot is delegated to. */
  unit: string;
  /**
   * False when the idle timer could not be rearmed, which means the server may
   * stay resident. The draw still succeeds — a card is worth more than a clean
   * shutdown — but the caller is told so it can be logged.
   */
  idleTimerArmed: boolean;
  /**
   * Why the server is not available, when it could not be brought up. Absent on
   * success. Present because a model that will not boot is not a failed request:
   * the routing policy decides what answers instead.
   */
  error?: string;
}

interface Deps {
  healthy: (url: string) => Promise<boolean>;
  systemctl: (args: string[]) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  healthyUrl: string;
  bootTimeoutMs: number;
  pollMs: number;
  unit: string;
  idleTimer: string;
}

const UNIT = process.env.MURMUR_MODEL_UNIT ?? "murmur-model.service";
const IDLE_TIMER = process.env.MURMUR_MODEL_IDLE_TIMER ?? "murmur-model-idle.timer";
// Named HEALTHY_URL, not URL: a bare `URL` here would shadow the global
// constructor inside this module and silently typecheck.
const HEALTHY_URL = process.env.MURMUR_LLAMACPP_URL ?? "http://127.0.0.1:11436";

function numberOr(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * A loading llama-server answers 503 *with a body*, so a status-code check alone
 * reports "up" long before there is anything to talk to. The body is the only
 * honest signal.
 */
export async function modelServerHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    return (await response.text()).includes('"ok"');
  } catch {
    return false;
  }
}

function runSystemctl(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "systemctl",
      args,
      { timeout: 20_000, env: process.env },
      (error, _stdout, stderr) => {
        if (error === null) {
          resolve();
          return;
        }
        const detail = stderr.trim();
        reject(new Error(`systemctl ${args.join(" ")} failed: ${detail || error.message}`));
      },
    );
  });
}

function defaultDeps(): Deps {
  return {
    healthy: modelServerHealthy,
    systemctl: runSystemctl,
    sleep,
    now: () => Date.now(),
    healthyUrl: HEALTHY_URL,
    bootTimeoutMs: numberOr(process.env.MURMUR_MODEL_BOOT_TIMEOUT_MS, 300_000),
    pollMs: numberOr(process.env.MURMUR_MODEL_POLL_MS, 1_000),
    unit: UNIT,
    idleTimer: IDLE_TIMER,
  };
}

/**
 * Push the shutdown back by another idle window. Called after work that uses the
 * server without going through a route — the overnight deepener does, and a card
 * there takes minutes, so without this the timer would stop the server halfway
 * through a run.
 */
export async function armIdleTimer(overrides: Partial<Deps> = {}): Promise<boolean> {
  const deps: Deps = { ...defaultDeps(), ...overrides };
  try {
    await deps.systemctl(["--user", "restart", deps.idleTimer]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make sure the model can answer, starting it if it is not already up.
 *
 * Throws when the server cannot be made healthy inside the boot timeout.
 */
export async function ensureModelServer(
  overrides: Partial<Deps> = {},
): Promise<ModelServerStatus> {
  const deps: Deps = { ...defaultDeps(), ...overrides };
  const startedAt = deps.now();

  if (await deps.healthy(deps.healthyUrl)) {
    return {
      started: false,
      waitedMs: 0,
      unit: deps.unit,
      idleTimerArmed: await armIdleTimer(deps),
    };
  }

  await deps.systemctl(["--user", "start", deps.unit]);

  const deadline = startedAt + deps.bootTimeoutMs;
  while (deps.now() < deadline) {
    await deps.sleep(deps.pollMs);
    if (await deps.healthy(deps.healthyUrl)) {
      return {
        started: true,
        waitedMs: deps.now() - startedAt,
        unit: deps.unit,
        idleTimerArmed: await armIdleTimer(deps),
      };
    }
  }

  throw new Error(
    `${deps.unit} was not healthy after ${Math.round(deps.bootTimeoutMs / 1000)}s`,
  );
}

/**
 * A curated draw must never boot the model: it is the instant button, and
 * starting a server that loads 10 GB of weights off disk would turn a
 * 100-millisecond draw into a multi-minute one. Returns null when the request
 * asked for the corpus instead.
 *
 * A model that will not boot is reported, not thrown. The provider will fail
 * fast against a server that is not there and the routing policy decides what
 * answers — which is the whole reason corpusFallback exists — so turning a boot
 * failure into a 500 would throw away the curated card she would otherwise have
 * been handed.
 */
export async function ensureModelForRequest(
  body: unknown,
  overrides: Partial<Deps> = {},
): Promise<ModelServerStatus | null> {
  const curatedOnly =
    typeof body === "object" &&
    body !== null &&
    (body as { curatedOnly?: unknown }).curatedOnly === true;
  if (curatedOnly) return null;
  const deps: Deps = { ...defaultDeps(), ...overrides };
  try {
    return await ensureModelServer(overrides);
  } catch (error) {
    return {
      started: false,
      waitedMs: 0,
      unit: deps.unit,
      idleTimerArmed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
