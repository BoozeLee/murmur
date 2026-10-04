import { GenerateRequestSchema } from "./schema";
import type { GenerateRequest, Idea, IdeaDraft } from "./schema";
import { PROMPT_VERSION, TOOL_POLICY_VERSION } from "./prompts";
import { corpusProvider } from "./providers/corpus";
import { createOllamaProvider } from "./providers/ollama";
import { createLlamacppProvider } from "./providers/llamacpp";
import type {
  GenerateContext,
  GenerationTelemetry,
  IdeaProvider,
  ProviderFailure,
  TaskClass,
} from "./providers/types";

/**
 * Routing policy, in code.
 *
 * The report is explicit that policy must never live in a prompt: a prompt is
 * text the model is free to ignore, and this app has exactly one model on one
 * machine, so "which provider answers this" is a decision the app makes before
 * the model is ever consulted.
 *
 * The policy table is intentionally flat and readable. Adding a hosted fallback
 * later means adding one row here and one adapter file — not editing prompts.
 */

export interface RoutingPolicy {
  taskClass: TaskClass;
  /** Which provider is asked first. */
  preferred: "ollama" | "llamacpp" | "corpus";
  /** Whether a curated draw is allowed to answer instead. Always true here. */
  corpusFallback: boolean;
  /**
   * Whether a hosted provider may be used at all. False everywhere: there is
   * no cloud provider configured, and a painting idea is not worth sending off
   * the machine.
   */
  cloudFallback: boolean;
  /** Upper bound on what one call may cost. Recorded, not yet enforceable. */
  maxCostEur: number;
  /** How many ideas the UI may ask for in one action. */
  maxCount: number;
  requiredOutput: "structured" | "none";
  why: string;
}

export const POLICIES: Record<TaskClass, RoutingPolicy> = {
  "deck.draw": {
    taskClass: "deck.draw",
    preferred: "llamacpp",
    corpusFallback: true,
    cloudFallback: false,
    maxCostEur: 0,
    maxCount: 4,
    requiredOutput: "structured",
    why: "The model whose prose is worth reading is the 30B MoE, locally, with nothing leaving the machine — but a card costs about a minute to write and she is browsing, not waiting, so the deck draws from the corpus by default and sends `curatedOnly`. This row is what answers when she asks for something new on purpose, and the corpus answers if the model server will not come up, so a draw never dead-ends.",
  },
  "deck.expand": {
    taskClass: "deck.expand",
    preferred: "llamacpp",
    corpusFallback: true,
    cloudFallback: false,
    maxCostEur: 0,
    maxCount: 1,
    requiredOutput: "structured",
    why: "Same privacy class and same model as a new card. But expanding is something she does mid-browse, so the default is the deterministic fusion of the idea with a corpus partner — instant, and a real idea rather than an apology. The model expansion is the opt-in: a minute of waiting for prose nobody has written down yet.",
  },
  "corpus.deepen": {
    taskClass: "corpus.deepen",
    preferred: "llamacpp",
    // A deepening run that silently answered from the existing corpus would
    // deepen nothing while reporting success, so there is no fallback here.
    corpusFallback: false,
    cloudFallback: false,
    maxCostEur: 0,
    maxCount: 1,
    requiredOutput: "structured",
    why: "Same model as a draw, but unattended: this is the one place a card can be afforded without anyone waiting, and the cards are validated and written to the corpus so later draws are instant. No fallback here — a deepening run that silently answered from the existing corpus would deepen nothing while reporting success.",
  },
};

export interface RunResult {
  ideas: Idea[];
  telemetry: GenerationTelemetry;
  /** Present when the preferred provider failed and the corpus answered. */
  fallback: { from: string; reason: string } | null;
}

type ProviderName = RoutingPolicy["preferred"];

const providers = new Map<ProviderName, IdeaProvider>();

function activeProvider(name: ProviderName): IdeaProvider {
  const existing = providers.get(name);
  if (existing !== undefined) return existing;
  // Created lazily so importing the router in a test does not read env vars.
  const created =
    name === "llamacpp" ? createLlamacppProvider() : createOllamaProvider();
  providers.set(name, created);
  return created;
}

/**
 * Test seam: pin a provider name to an instance, or pass null to unpin it. The
 * next call rebuilds from the policy table.
 */
export function setProvider(name: ProviderName, next: IdeaProvider | null): void {
  if (next === null) providers.delete(name);
  else providers.set(name, next);
}

function requestId(): string {
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * The one function the UI calls. Everything above it — route handlers, the
 * daily push — knows only this signature, so the providers can be swapped
 * without a caller changing.
 */
export async function generateIdeas(input: unknown): Promise<RunResult> {
  return run("deck.draw", input, [], []);
}

export async function run(
  taskClass: TaskClass,
  input: unknown,
  seeds: IdeaDraft[],
  excludeTitles: readonly string[],
): Promise<RunResult> {
  const policy = POLICIES[taskClass];
  const parsed = GenerateRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new RequestError(
      `bad request: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`).join(", ")}`,
    );
  }
  const requested: GenerateRequest = parsed.data;
  if (requested.count > policy.maxCount) {
    throw new RequestError(`count exceeds the ${policy.maxCount} allowed for ${taskClass}`);
  }

  const id = requestId();
  const context: GenerateContext = {
    request: requested,
    seeds,
    excludeTitles,
    taskClass,
  };

  const telemetryBase = {
    requestId: id,
    taskClass,
    dataSensitivity: "local_only" as const,
    promptVersion: PROMPT_VERSION,
    toolPolicyVersion: TOOL_POLICY_VERSION,
  };

  // `curatedOnly` skips the model entirely — it is an explicit user choice,
  // not a fallback.
  if (requested.curatedOnly || policy.preferred === "corpus") {
    const outcome = await corpusProvider.generate(context);
    return {
      ideas: outcome.ideas,
      fallback: null,
      telemetry: {
        ...telemetryBase,
        provider: "corpus",
        model: null,
        latencyMs: outcome.stats.latencyMs,
        inputTokens: null,
        outputTokens: null,
        fallbackUsed: false,
        fallbackReason: null,
        requested: requested.count,
        returned: outcome.ideas.length,
        validationFailures: 0,
        terminationReason: outcome.failure === null ? "complete" : "empty",
      },
    };
  }

  const primary = activeProvider(policy.preferred);
  const outcome = await primary.generate(context);

  if (outcome.failure === null) {
    return {
      ideas: outcome.ideas,
      fallback: null,
      telemetry: {
        ...telemetryBase,
        provider: primary.name,
        model: outcome.ideas[0]?.model ?? null,
        latencyMs: outcome.stats.latencyMs,
        inputTokens: outcome.stats.inputTokens,
        outputTokens: outcome.stats.outputTokens,
        fallbackUsed: false,
        fallbackReason: null,
        requested: requested.count,
        returned: outcome.ideas.length,
        validationFailures: outcome.stats.validationFailures,
        terminationReason: "complete",
      },
    };
  }

  if (!policy.corpusFallback) {
    throw new RequestError(`${primary.name} failed: ${outcome.failure.detail}`);
  }

  const fallbackOutcome = await corpusProvider.generate(context);
  const reason = `${outcome.failure.kind}: ${outcome.failure.detail}`;

  if (fallbackOutcome.failure !== null) {
    throw new RequestError(`${primary.name} failed (${reason}) and so did the corpus (${fallbackOutcome.failure.detail})`);
  }

  return {
    ideas: fallbackOutcome.ideas,
    fallback: { from: primary.name, reason },
    telemetry: {
      ...telemetryBase,
      provider: "corpus",
      model: null,
      // Both legs are real work, so both are counted.
      latencyMs: outcome.stats.latencyMs + fallbackOutcome.stats.latencyMs,
      inputTokens: outcome.stats.inputTokens,
      outputTokens: outcome.stats.outputTokens,
      fallbackUsed: true,
      fallbackReason: reason,
      requested: requested.count,
      returned: fallbackOutcome.ideas.length,
      validationFailures: outcome.stats.validationFailures,
      terminationReason: terminationReasonFor(outcome.failure.kind),
    },
  };
}

/** Take one idea further, same policy shape, same fallback contract. */
export async function expandIdea(
  idea: IdeaDraft,
  options: { signal?: AbortSignal; curatedOnly?: boolean } = {},
): Promise<RunResult> {
  const started = Date.now();
  const { signal, curatedOnly = false } = options;
  const telemetryBase = {
    requestId: requestId(),
    taskClass: "deck.expand" as const,
    dataSensitivity: "local_only" as const,
    promptVersion: PROMPT_VERSION,
    toolPolicyVersion: TOOL_POLICY_VERSION,
  };
  const telemetry = (
    outcome: Pick<
      GenerationTelemetry,
      | "provider"
      | "model"
      | "latencyMs"
      | "inputTokens"
      | "outputTokens"
      | "fallbackUsed"
      | "fallbackReason"
      | "terminationReason"
    >,
  ): GenerationTelemetry => ({
    ...telemetryBase,
    ...outcome,
    requested: 1,
    returned: 1,
    validationFailures: 0,
  });

  // A curated expansion is a deterministic fusion with a corpus partner. It is
  // the deck's default because it is instant, and because it was asked for on
  // purpose it is not a fallback — so it reports exactly what a curated draw
  // reports, rather than a card the model failed to improve.
  if (curatedOnly) {
    const fused = await corpusProvider.expand(idea, signal);
    if (fused === null) {
      throw new RequestError("could not expand: the corpus has no partner left");
    }
    return {
      ideas: [fused],
      fallback: null,
      telemetry: telemetry({
        provider: "corpus",
        model: null,
        latencyMs: Date.now() - started,
        inputTokens: null,
        outputTokens: null,
        fallbackUsed: false,
        fallbackReason: null,
        terminationReason: "complete",
      }),
    };
  }

  const primary = activeProvider(POLICIES["deck.expand"].preferred);
  const expanded = await primary.expand(idea, signal);

  if (expanded !== null) {
    return {
      ideas: [expanded],
      fallback: null,
      telemetry: telemetry({
        provider: primary.name,
        model: expanded.model ?? null,
        latencyMs: expanded.latencyMs ?? Date.now() - started,
        inputTokens: expanded.inputTokens ?? null,
        outputTokens: expanded.outputTokens ?? null,
        fallbackUsed: false,
        fallbackReason: null,
        terminationReason: "complete",
      }),
    };
  }

  const fused = await corpusProvider.expand(idea, signal);
  if (fused === null) {
    throw new RequestError("could not expand: the model failed and the corpus has no partner left");
  }

  return {
    ideas: [fused],
    fallback: { from: primary.name, reason: "model produced no usable expansion" },
    telemetry: telemetry({
      provider: "corpus",
      model: null,
      latencyMs: Date.now() - started,
      inputTokens: null,
      outputTokens: null,
      fallbackUsed: true,
      fallbackReason: "model produced no usable expansion",
      terminationReason: "validation_rejected",
    }),
  };
}

/** An error the caller caused, with the status it deserves. Anything else is a 500. */
export class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function terminationReasonFor(
  kind: ProviderFailure["kind"],
): GenerationTelemetry["terminationReason"] {
  switch (kind) {
    case "aborted":
      return "aborted";
    case "timeout":
      return "timeout";
    case "provider_error":
    case "unreachable":
      return "provider_error";
    case "malformed":
    case "rejected":
      return "validation_rejected";
    case "empty":
      return "empty";
  }
}