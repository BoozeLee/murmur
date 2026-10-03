import { ideaJsonSchema } from "../schema";
import type { Idea, IdeaDraft } from "../schema";
import {
  PROMPT_VERSION,
  TOOL_POLICY_VERSION,
  correctionPrompt,
  systemPrompt,
  userPrompt,
} from "../prompts";
import { parseDrafts } from "./parse";
import type {
  GenerateContext,
  IdeaProvider,
  ProviderFailure,
  ProviderOutcome,
  ProviderStats,
} from "./types";

/**
 * Local model access, and the only file in the app that talks to Ollama.
 *
 * Three rules from the architecture report are enforced here rather than
 * trusted to discipline:
 *  1. Ollama stays on the server. This module is imported by a route handler,
 *     never by a client component — nothing privileged is reachable from the
 *     browser.
 *  2. Model output is untrusted input. It arrives as a string and leaves this
 *     module only after `IdeaDraftSchema` accepts it.
 *  3. Every call is bounded: a timeout, a token ceiling, and one corrective
 *     retry. An 8B model on a shared GPU is a finite resource and the app must
 *     never hang waiting for it.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export interface OllamaOptions {
  model: string;
  timeoutMs: number;
  maxTokens: number;
  keepAlive: string;
  /** Corrective attempts after a schema rejection. One is the honest budget. */
  maxRepairs: number;
}

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const defaultOllamaOptions: OllamaOptions = {
  model: process.env.MURMUR_MODEL ?? "qwen3:8b",
  timeoutMs: numberOr(process.env.MURMUR_TIMEOUT_MS, 90_000),
  maxTokens: numberOr(process.env.MURMUR_MAX_TOKENS, 900),
  keepAlive: process.env.MURMUR_KEEP_ALIVE ?? "10m",
  maxRepairs: 1,
};

interface ChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
  error?: string;
}

interface CallResult {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  failure: ProviderFailure | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function chat(
  messages: { role: string; content: string }[],
  options: OllamaOptions,
  temperature: number,
  signal: AbortSignal | undefined,
): Promise<CallResult> {
  const started = Date.now();
  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signals = signal === undefined ? [timeout] : [timeout, signal];

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.any(signals),
      body: JSON.stringify({
        model: options.model,
        stream: false,
        // qwen3 is a thinking model; chain-of-thought is latency spent on a
        // formatting task it does not need to reason about.
        think: false,
        keep_alive: options.keepAlive,
        format: ideaJsonSchema(),
        options: { temperature, num_predict: options.maxTokens },
        messages,
      }),
    });
  } catch (error) {
    const clientGone = signal?.aborted === true;
    return {
      content: "",
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - started,
      failure: {
        kind: clientGone ? "aborted" : timeout.aborted ? "timeout" : "unreachable",
        detail: clientGone ? "client went away" : errorMessage(error),
      },
    };
  }

  const fail = (detail: string): CallResult => ({
    content: "",
    inputTokens: null,
    outputTokens: null,
    latencyMs: Date.now() - started,
    failure: { kind: "provider_error", detail },
  });

  if (!response.ok) return fail(`HTTP ${response.status}`);

  const body = (await response.json()) as ChatResponse;
  if (body.error !== undefined) return fail(body.error);

  const content = body.message?.content ?? "";
  const tokens = {
    inputTokens: body.prompt_eval_count ?? null,
    outputTokens: body.eval_count ?? null,
  };
  const latencyMs = Date.now() - started;

  if (content.trim().length === 0) {
    return { content, ...tokens, latencyMs, failure: { kind: "empty", detail: "no content" } };
  }
  return { content, ...tokens, latencyMs, failure: null };
}

/** Non-crypto hash; idea ids only need to be unique, not unguessable. */
function hash(value: string): number {
  let out = 0;
  for (let index = 0; index < value.length; index += 1) {
    out = (Math.imul(out, 31) + value.charCodeAt(index)) | 0;
  }
  return out;
}

function stamp(
  draft: IdeaDraft,
  options: OllamaOptions,
  stats: ProviderStats,
  createdAt: string,
): Idea {
  return {
    ...draft,
    id: `ollama-${createdAt}-${Math.abs(hash(draft.title + createdAt)).toString(36)}`,
    source: "ollama",
    createdAt,
    provider: "ollama",
    model: options.model,
    latencyMs: stats.latencyMs,
    promptVersion: PROMPT_VERSION,
    toolPolicyVersion: TOOL_POLICY_VERSION,
    ...(stats.inputTokens === null ? {} : { inputTokens: stats.inputTokens }),
    ...(stats.outputTokens === null ? {} : { outputTokens: stats.outputTokens }),
  };
}

const zeroStats = (): ProviderStats => ({
  latencyMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  validationFailures: 0,
});

/**
 * Sum two stat records. Zero counts are reported as null rather than 0, because
 * "the model told us nothing" and "the model used nothing" are different facts
 * and only the first one is true when a call failed before generation started.
 */
function mergeStats(base: ProviderStats, add: ProviderStats): ProviderStats {
  const input = (base.inputTokens ?? 0) + (add.inputTokens ?? 0);
  const output = (base.outputTokens ?? 0) + (add.outputTokens ?? 0);
  return {
    latencyMs: base.latencyMs + add.latencyMs,
    inputTokens: input === 0 ? null : input,
    outputTokens: output === 0 ? null : output,
    validationFailures: base.validationFailures + add.validationFailures,
  };
}

export function createOllamaProvider(
  options: OllamaOptions = defaultOllamaOptions,
): IdeaProvider {
  /**
   * One idea per call, `count` times.
   *
   * The JSON schema describes a single object, so batching would mean either a
   * different schema for a different call path or a nested array — and nested
   * schemas are exactly where structured output on an 8B model gets
   * unreliable. Sequential calls cost latency on an explicit "give me four"
   * action, which is a fair trade for cards that always validate.
   */
  async function generate(context: GenerateContext): Promise<ProviderOutcome> {
    const { request } = context;
    const totals = zeroStats();
    const ideas: Idea[] = [];
    const seen = new Set(context.excludeTitles);

    for (let index = 0; index < request.count; index += 1) {
      const messages = [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: userPrompt({
            ...(request.category === undefined ? {} : { category: request.category }),
            ...(request.tags === undefined ? {} : { tags: request.tags }),
            seedTitles: context.seeds.map((seed) => seed.title),
            nudge:
              index === 0
                ? undefined
                : `This is idea ${index + 1} of ${request.count}. It must be a different picture from a different corner of the subject, not a variation on the same one.`,
          }),
        },
      ];

      let callStats = zeroStats();
      let produced: IdeaDraft[] = [];
      let lastReason = "";
      let repairs = 0;

      for (let attempt = 0; attempt <= options.maxRepairs; attempt += 1) {
        const call = await chat(messages, options, request.temperature, context.signal);
        callStats.latencyMs += call.latencyMs;
        callStats.inputTokens = (callStats.inputTokens ?? 0) + (call.inputTokens ?? 0);
        callStats.outputTokens = (callStats.outputTokens ?? 0) + (call.outputTokens ?? 0);

        if (call.failure !== null) {
          return {
            ideas: [],
            failure: call.failure,
            stats: mergeStats(totals, callStats),
          };
        }

        const parsed = parseDrafts(call.content);
        if (parsed.drafts !== null) {
          produced = parsed.drafts;
          break;
        }

        callStats.validationFailures += 1;
        totals.validationFailures += 1;
        lastReason = parsed.reason;
        repairs = attempt + 1;
        // The rejection and its reason go back in, so the repair is informed
        // rather than a blind retry.
        messages.push({ role: "assistant", content: call.content });
        messages.push({ role: "user", content: correctionPrompt(parsed.reason) });
      }

      if (produced.length === 0) {
        return {
          ideas: [],
          failure: { kind: "rejected", detail: `${repairs} repair(s) failed: ${lastReason}` },
          stats: mergeStats(totals, callStats),
        };
      }

      const createdAt = new Date().toISOString();
      for (const draft of produced) {
        if (seen.has(draft.title)) continue;
        seen.add(draft.title);
        ideas.push(stamp(draft, options, callStats, createdAt));
      }

      totals.latencyMs += callStats.latencyMs;
      totals.inputTokens = (totals.inputTokens ?? 0) + (callStats.inputTokens ?? 0);
      totals.outputTokens = (totals.outputTokens ?? 0) + (callStats.outputTokens ?? 0);
    }

    totals.inputTokens = totals.inputTokens === 0 ? null : totals.inputTokens;
    totals.outputTokens = totals.outputTokens === 0 ? null : totals.outputTokens;

    if (ideas.length === 0) {
      return {
        ideas: [],
        failure: { kind: "empty", detail: "model repeated ideas already on screen" },
        stats: totals,
      };
    }

    return { ideas, failure: null, stats: totals };
  }

  async function expand(idea: IdeaDraft, signal?: AbortSignal): Promise<Idea | null> {
    const messages = [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content:
          userPrompt({
            category: idea.category,
            tags: idea.tags,
            seedTitles: [idea.title],
          }) +
          `\nThe idea to take further:\n  concept: ${idea.concept}\n  tension: ${idea.tension}\n  light: ${idea.light}\n  palette: ${idea.palette.join(", ")}\n  medium: ${idea.medium}\n\nMove it somewhere it could not have come from. Change the subject, not the words.`,
      },
    ];

    const call = await chat(messages, options, 1.2, signal);
    if (call.failure !== null) return null;
    const draft = parseDrafts(call.content).drafts?.[0];
    if (draft === undefined) return null;
    return stamp(
      draft,
      options,
      {
        latencyMs: call.latencyMs,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        validationFailures: 0,
      },
      new Date().toISOString(),
    );
  }

  return { name: "ollama", generate, expand };
}