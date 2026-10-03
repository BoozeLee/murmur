import type { GenerateRequest, Idea, IdeaDraft } from "../schema";
import { PROMPT_VERSION, TOOL_POLICY_VERSION } from "../prompts";

/**
 * The provider boundary.
 *
 * Business logic never imports Ollama. It calls `generateIdeas` in `router.ts`,
 * which picks a provider from a policy table. Swapping the local model for a
 * hosted one is a change to one file and no change to the app.
 */

/** The per-generation record the report asks for. */
export interface GenerationTelemetry {
  requestId: string;
  taskClass: TaskClass;
  dataSensitivity: "local_only" | "may_leave_lan";
  provider: string;
  model: string | null;
  promptVersion: string;
  toolPolicyVersion: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  requested: number;
  returned: number;
  validationFailures: number;
  terminationReason:
    | "complete"
    | "timeout"
    | "provider_error"
    | "validation_rejected"
    | "empty"
    | "aborted";
}

/**
 * `corpus.deepen` is not a user action: it is the overnight batch that writes
 * model-authored cards into the curated corpus. It is a separate class because
 * it is the only task allowed to prefer the slow 30B runner.
 */
export type TaskClass = "deck.draw" | "deck.expand" | "corpus.deepen";

export interface GenerateContext {
  request: GenerateRequest;
  /** Ideas the model should riff on. Also the `seedFrom` titles. */
  seeds: IdeaDraft[];
  /** Titles already on screen, so neither provider repeats one. */
  excludeTitles: readonly string[];
  taskClass: TaskClass;
  signal?: AbortSignal | undefined;
}

export interface ProviderOutcome {
  ideas: Idea[];
  /** Populated only on failure, so the router can report *why* it fell back. */
  failure: ProviderFailure | null;
  /**
   * What the provider actually observed. The router copies this into the run's
   * telemetry rather than the provider keeping mutable state of its own — a
   * module-level counter would be wrong the moment two requests overlap.
   */
  stats: ProviderStats;
}

export interface ProviderStats {
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** How many model answers were thrown out for failing the schema. */
  validationFailures: number;
}

export interface ProviderFailure {
  kind:
    | "timeout"
    | "unreachable"
    | "provider_error"
    | "malformed"
    | "rejected"
    | "empty"
    | "aborted";
  detail: string;
}

export interface IdeaProvider {
  readonly name: string;
  generate(context: GenerateContext): Promise<ProviderOutcome>;
  /** Take one existing idea further. Returns null when it cannot. */
  expand(idea: IdeaDraft, signal?: AbortSignal | undefined): Promise<Idea | null>;
}

export const telemetryDefaults = {
  promptVersion: PROMPT_VERSION,
  toolPolicyVersion: TOOL_POLICY_VERSION,
};