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
 * A second local model, reached over llama.cpp's OpenAI-compatible endpoint.
 *
 * Why this exists at all: the deck is answered by an 8B model that fits in
 * 8 GB of VRAM and answers in ten seconds. There is also a 30B-parameter MoE on
 * this machine whose prose was distilled from a much stronger model — it cannot
 * answer interactively (its weights do not fit in VRAM, so expert routing lands
 * on the CPU), but it can answer overnight. So this provider serves exactly one
 * task class, `corpus.deepen`, and its output is written into the curated corpus
 * where the next day's draws will meet it.
 *
 * Nothing here reaches the browser, and nothing leaves the machine.
 */

const LLAMACPP_URL = process.env.MURMUR_LLAMACPP_URL ?? "http://127.0.0.1:11436";

export interface LlamacppOptions {
  /** Passed through to llama.cpp; it selects the loaded GGUF. */
  model: string;
  /**
   * Generous by design. This model generates a few tokens per second, so a card
   * costs minutes, not seconds. The interactive providers time out at 90s because
   * a human is waiting; here the ceiling exists only to stop a hung server.
   */
  timeoutMs: number;
  maxTokens: number;
  /** Corrective attempts after a rejection. One, as everywhere else. */
  maxRepairs: number;
}

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const defaultLlamacppOptions: LlamacppOptions = {
  model: process.env.MURMUR_LLAMACPP_MODEL ?? "glm-creative",
  timeoutMs: numberOr(process.env.MURMUR_LLAMACPP_TIMEOUT_MS, 1_800_000),
  maxTokens: numberOr(process.env.MURMUR_LLAMACPP_MAX_TOKENS, 1200),
  maxRepairs: 1,
};

interface ChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
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

function errorDetail(error: ChatResponse["error"]): string | null {
  if (error === undefined) return null;
  return typeof error === "string" ? error : (error.message ?? "unknown error");
}

/**
 * One chat turn against llama.cpp.
 *
 * Three request-level choices are load-bearing:
 *  - `response_format` with the same zod-derived JSON Schema the Ollama path uses,
 *    so both runners are constrained by one contract.
 *  - `chat_template_kwargs.enable_thinking: false`. This model's template turns
 *    thinking on by default, and with a slow MoE the thinking tokens consume the
 *    whole output budget before any card is written.
 *  - `cache_prompt: true`, because a corrective retry re-sends the same prefix.
 */
async function chat(
  messages: { role: string; content: string }[],
  options: LlamacppOptions,
  temperature: number,
  signal: AbortSignal | undefined,
): Promise<CallResult> {
  const started = Date.now();

  // The deadline is ours, not AbortSignal.timeout's. Measured on this box: that
  // signal fires at 300 s whatever value it is given, while a card from this MoE
  // takes minutes at the ~0.8 tok/s it manages with half its weights on the CPU.
  // A 300 s ceiling cut the first real attempt off at 605 tokens, mid-card, with
  // the JSON never closed. So: a controller we abort by hand, with the reason
  // kept beside it so the failure says which of the two limits was hit.
  const controller = new AbortController();
  const abortState = { client: false, deadline: false };
  const onClientAbort = (): void => {
    abortState.client = true;
    controller.abort();
  };
  signal?.addEventListener("abort", onClientAbort);
  // An already-aborted signal emits no further event, so the state is set here
  // too. AbortSignal.any() did this for free; the hand-rolled controller does not.
  if (signal?.aborted === true) onClientAbort();
  const deadline = setTimeout(() => {
    abortState.deadline = true;
    controller.abort();
  }, options.timeoutMs);

  const blank = (failure: ProviderFailure): CallResult => ({
    content: "",
    inputTokens: null,
    outputTokens: null,
    latencyMs: Date.now() - started,
    failure,
  });

  let response: Response;
  try {
    try {
      response = await fetch(`${LLAMACPP_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature,
          max_tokens: options.maxTokens,
          stream: false,
          cache_prompt: true,
          chat_template_kwargs: { enable_thinking: false },
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "murmur_idea",
              strict: true,
              schema: ideaJsonSchema(),
            },
          },
        }),
      });
    } catch (error) {
      const kind = abortState.client
        ? "aborted"
        : abortState.deadline
          ? "timeout"
          : "unreachable";
      const detail = abortState.client
        ? "client went away"
        : abortState.deadline
          ? `no card after ${Math.round(options.timeoutMs / 1000)}s`
          : errorMessage(error);
      return blank({ kind, detail });
    }

    const latencyMs = Date.now() - started;
    if (!response.ok) {
      // 503 is llama.cpp's own "still loading the model", so it is named rather
      // than lumped in with a real fault.
      const waiting = response.status === 503 ? " (model still loading)" : "";
      return blank({
        kind: "provider_error",
        detail: `HTTP ${response.status} ${response.statusText}${waiting}`,
      });
    }

    const body = (await response.json()) as ChatResponse;
    const errored = errorDetail(body.error);
    if (errored !== null) return blank({ kind: "provider_error", detail: errored });

    const choice = body.choices?.[0];
    const content = choice?.message?.content ?? "";
    const inputTokens = body.usage?.prompt_tokens ?? null;
    const outputTokens = body.usage?.completion_tokens ?? null;

    if (choice?.finish_reason === "length") {
      // The JSON was cut mid-object. Retrying would cost another few minutes to
      // reach the same wall, so this is reported instead of repaired.
      return {
        content,
        inputTokens,
        outputTokens,
        latencyMs,
        failure: {
          kind: "malformed",
          detail: `output hit the ${options.maxTokens} token ceiling before the card was closed`,
        },
      };
    }

    if (content.trim().length === 0) {
      return {
        content,
        inputTokens,
        outputTokens,
        latencyMs,
        failure: { kind: "empty", detail: "no content" },
      };
    }

    return { content, inputTokens, outputTokens, latencyMs, failure: null };
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", onClientAbort);
  }
}

/** Non-crypto hash; idea ids only need to be unique, not unguessable. */
function hash(value: string): number {
  let out = 0;
  for (let index = 0; index < value.length; index += 1) {
    out = (Math.imul(out, 31) + value.charCodeAt(index)) | 0;
  }
  return out;
}

/**
 * Generated cards are stamped `source: "corpus"` on purpose.
 *
 * They are not shown live from this provider — they are validated, written to the
 * corpus file, and only reach her as curated draws from then on. Stamping
 * them with what they will actually be keeps the shelf's provenance honest, and
 * the model that wrote each one is recorded alongside it in that corpus file.
 */
function stamp(
  draft: IdeaDraft,
  options: LlamacppOptions,
  stats: ProviderStats,
  createdAt: string,
): Idea {
  return {
    ...draft,
    id: `llamacpp-${createdAt}-${Math.abs(hash(draft.title + createdAt)).toString(36)}`,
    source: "corpus",
    createdAt,
    provider: "llamacpp",
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

export function createLlamacppProvider(
  options: LlamacppOptions = defaultLlamacppOptions,
): IdeaProvider {
  /** One card per call, `count` times — same reasoning as the Ollama provider. */
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

        // Any transport or truncation fault returns here rather than being
        // repaired: a retry costs minutes and reaches the same wall. Only a
        // schema rejection below is worth a second attempt.
        if (call.failure !== null) {
          return { ideas: [], failure: call.failure, stats: mergeStats(totals, callStats) };
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
    const outcome = await generate({
      request: {
        category: idea.category,
        tags: idea.tags.slice(0, 4),
        count: 1,
        temperature: 1.2,
        curatedOnly: false,
      },
      seeds: [idea],
      excludeTitles: [idea.title],
      taskClass: "corpus.deepen",
      ...(signal === undefined ? {} : { signal }),
    });
    return outcome.ideas[0] ?? null;
  }

  return { name: "llamacpp", generate, expand };
}
