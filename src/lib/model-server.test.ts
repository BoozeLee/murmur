import { afterEach, describe, expect, it, vi } from "vitest";
import {
  armIdleTimer,
  ensureModelForRequest,
  ensureModelServer,
  modelServerHealthy,
} from "./model-server";

/**
 * Every external effect is injected, so these tests never touch systemd or a real
 * llama-server. The clock is faked rather than slept through: a boot poll that
 * really waited would make the suite take minutes.
 */
function fakeDeps(overrides: Record<string, unknown> = {}) {
  const calls: string[][] = [];
  let clock = 0;
  const record = async (args: string[]): Promise<void> => {
    calls.push(args);
  };
  return {
    calls,
    deps: {
      healthy: async () => true,
      systemctl: record,
      sleep: async () => {
        clock += 1_000;
      },
      now: () => clock,
      healthyUrl: "http://127.0.0.1:9",
      bootTimeoutMs: 5_000,
      pollMs: 1_000,
      unit: "murmur-model.service",
      idleTimer: "murmur-model-idle.timer",
      ...overrides,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensureModelServer", () => {
  it("does not start anything when the server is already up", async () => {
    const { calls, deps } = fakeDeps();
    const status = await ensureModelServer(deps);
    expect(status.started).toBe(false);
    expect(status.waitedMs).toBe(0);
    expect(calls).toEqual([["--user", "restart", "murmur-model-idle.timer"]]);
  });

  it("starts the unit when nothing is listening and waits for the weights", async () => {
    let healthyCalls = 0;
    const { calls, deps } = fakeDeps({
      healthy: async () => {
        healthyCalls += 1;
        return healthyCalls > 2;
      },
    });
    const status = await ensureModelServer(deps);
    expect(status.started).toBe(true);
    expect(status.waitedMs).toBe(2_000);
    expect(calls[0]).toEqual(["--user", "start", "murmur-model.service"]);
    expect(status.idleTimerArmed).toBe(true);
  });

  it("gives up with the boot timeout in the message rather than polling forever", async () => {
    const { deps } = fakeDeps({ healthy: async () => false, bootTimeoutMs: 3_000 });
    await expect(ensureModelServer(deps)).rejects.toThrow(
      "murmur-model.service was not healthy after 3s",
    );
  });

  it("reports a card even when the idle timer cannot be armed", async () => {
    const { deps } = fakeDeps({
      systemctl: async (args: string[]) => {
        if (args[2] === "murmur-model-idle.timer") throw new Error("no such unit");
      },
    });
    const status = await ensureModelServer(deps);
    expect(status.idleTimerArmed).toBe(false);
    expect(status.started).toBe(false);
  });
});

describe("armIdleTimer", () => {
  it("returns false instead of throwing when systemctl rejects", async () => {
    const { deps } = fakeDeps({
      systemctl: async () => {
        throw new Error("systemd is not reachable");
      },
    });
    expect(await armIdleTimer(deps)).toBe(false);
  });
});

describe("ensureModelForRequest", () => {
  it("never wakes the model for a curated draw", async () => {
    let touched = false;
    const { deps } = fakeDeps({
      healthy: async () => {
        touched = true;
        return true;
      },
    });
    expect(await ensureModelForRequest({ curatedOnly: true }, deps)).toBeNull();
    expect(touched).toBe(false);
  });

  it("reports a server that will not boot instead of failing the request", async () => {
    const { deps } = fakeDeps({ healthy: async () => false, bootTimeoutMs: 2_000 });
    const status = await ensureModelForRequest({}, deps);
    expect(status).not.toBeNull();
    expect(status?.error).toContain("was not healthy after 2s");
    expect(status?.started).toBe(false);
  });

  it("treats a body that is not an object as a model request", async () => {
    const { calls, deps } = fakeDeps();
    await ensureModelForRequest(null, deps);
    expect(calls[0]).toEqual(["--user", "restart", "murmur-model-idle.timer"]);
  });
});

describe("modelServerHealthy", () => {
  it("trusts the body, not the status code", async () => {
    // A loading llama-server answers 503 *with* a body, which is exactly how a
    // status-code-only check reports "up" before anything can be asked of it.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":{"code":503}}', { status: 503 })),
    );
    expect(await modelServerHealthy("http://x")).toBe(false);
  });

  it("reports healthy only on a 200 whose body says ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })),
    );
    expect(await modelServerHealthy("http://x")).toBe(true);
  });

  it("reports unhealthy when the port is closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    expect(await modelServerHealthy("http://x")).toBe(false);
  });
});
