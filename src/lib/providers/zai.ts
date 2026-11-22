import type { ArtworkAnalysisRequest } from "../artwork";
import { fingerprintToBrief } from "../artwork";
import {
  correctionPrompt,
  PROMPT_VERSION,
  systemPrompt,
  TOOL_POLICY_VERSION,
  userPrompt,
} from "../prompts";
import type { Idea, IdeaDraft } from "../schema";
import { ideaJsonSchema } from "../schema";
import { parseDrafts } from "./parse";
import type {
  GenerateContext,
  IdeaProvider,
  ProviderFailure,
  ProviderOutcome,
  ProviderStats,
} from "./types";

/**
 * An optional hosted provider.
 *
 * It is never the default. The corpus answers instantly and locally; this file
 * is used only when she asks for something new and `MURMUR_CLOUD_PROVIDER=zai`
 * is set with a key, or when she uploads a painting and asks for an improvement
 * (there is no vision model on this machine). `corpus.deepen` never reaches it.
 *
 * The endpoint is OpenAI-compatible, so the request/response shapes mirror the
 * local llama.cpp provider. Everything that comes back still goes through the
 * same `parseDrafts` gate as local output — hosted output is untrusted too.
 */

const ZAI_BASE_URL = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4";

export interface ZaiOptions {
  model: string;
  visionModel: string;
  timeoutMs: number;
  maxTokens: number;
  maxRepairs: number;
}

function numberOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const defaultZaiOptions: ZaiOptions = {
  model: process.env.ZAI_MODEL ?? "glm-4.7-flash",
  visionModel: process.env.ZAI_VISION_MODEL ?? "glm-4.6v-flash",
  timeoutMs: numberOr(process.env.ZAI_TIMEOUT_MS, 90_000),
  maxTokens: numberOr(process.env.ZAI_MAX_TOKENS, 1200),
  maxRepairs: 1,
};

export function zaiConfigured(): boolean {
  const key = process.env.ZAI_API_KEY;
  return key !== undefined && key.trim().length > 0;
}

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };

type ChatMessage =
  | { role: string; content: string }
  | { role: string; content: (TextPart | ImagePart)[] };

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
  if (typeof error === "string") return error;
  return error?.message ?? null;
}

async function chat(
  messages: ChatMessage[],
  model: string,
  options: ZaiOptions,
  temperature: number,
  signal: AbortSignal | undefined,
): Promise<CallResult> {
  const started = Date.now();
  const key = process.env.ZAI_API_KEY?.trim() ?? "";
  if (key.length === 0) {
    return {
      content: "",
      inputTokens: null,
      outputTokens: null,
      latencyMs: 0,
      failure: { kind: "unreachable", detail: "ZAI_API_KEY is not set" },
    };
  }

  const timeout = AbortSignal.timeout(options.timeoutMs);
  const signals = signal === undefined ? [timeout] : [timeout, signal];
  let response: Response;
  try {
    response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "accept-language": "en-US,en",
      },
      signal: AbortSignal.any(signals),
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: options.maxTokens,
        stream: false,
        response_format: { type: "json_object" },
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

  const fail = (detail: string, kind: ProviderFailure["kind"] = "provider_error"): CallResult => ({
    content: "",
    inputTokens: null,
    outputTokens: null,
    latencyMs: Date.now() - started,
    failure: { kind, detail },
  });

  if (!response.ok) return fail(`HTTP ${response.status}`);

  let body: ChatResponse;
  try {
    body = (await response.json()) as ChatResponse;
  } catch (error) {
    return fail(`invalid JSON response: ${errorMessage(error)}`, "malformed");
  }
  const detail = errorDetail(body.error);
  if (detail !== null) return fail(detail);

  const content = body.choices?.[0]?.message?.content ?? "";
  const tokens = {
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
  const latencyMs = Date.now() - started;
  if (content.trim().length === 0) {
    return { content, ...tokens, latencyMs, failure: { kind: "empty", detail: "no content" } };
  }
  return { content, ...tokens, latencyMs, failure: null };
}

function hash(value: string): number {
  let out = 0;
  for (let index = 0; index < value.length; index += 1) {
    out = (Math.imul(out, 31) + value.charCodeAt(index)) | 0;
  }
  return out;
}

function stamp(draft: IdeaDraft, model: string, stats: ProviderStats, createdAt: string): Idea {
  return {
    ...draft,
    id: `zai-${createdAt}-${Math.abs(hash(draft.title + createdAt)).toString(36)}`,
    source: "zai",
    createdAt,
    provider: "zai",
    model,
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

function outcomeFromCall(call: CallResult, model: string, createdAt: string): ProviderOutcome {
  const stats: ProviderStats = {
    latencyMs: call.latencyMs,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    validationFailures: 0,
  };
  if (call.failure !== null) return { ideas: [], failure: call.failure, stats };
  const drafts = parseDrafts(call.content);
  if (drafts.drafts === null) {
    return {
      ideas: [],
      failure: { kind: "rejected", detail: drafts.reason },
      stats: { ...stats, validationFailures: 1 },
    };
  }
  return {
    ideas: drafts.drafts.map((draft) => stamp(draft, model, stats, createdAt)),
    failure: null,
    stats,
  };
}

export function createZaiProvider(options: ZaiOptions = defaultZaiOptions): IdeaProvider {
  async function generate(context: GenerateContext): Promise<ProviderOutcome> {
    const { request } = context;
    const totals = zeroStats();
    const ideas: Idea[] = [];
    const seen = new Set(context.excludeTitles);

    for (let index = 0; index < request.count; index += 1) {
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: userPrompt({
            ...(request.category === undefined ? {} : { category: request.category }),
            ...(request.tags === undefined ? {} : { tags: request.tags }),
            ...(request.brief === undefined ? {} : { brief: request.brief }),
            language: request.language,
            seedTitles: context.seeds.map((seed) => seed.title),
            nudge:
              index === 0
                ? undefined
                : `This is idea ${index + 1} of ${request.count}. It must be a different picture from a different corner of the subject, not a variation on the same one.`,
          }),
        },
      ];

      const callStats = zeroStats();
      let produced: IdeaDraft[] = [];
      let lastReason = "";
      let repairs = 0;

      for (let attempt = 0; attempt <= options.maxRepairs; attempt += 1) {
        const call = await chat(
          messages,
          options.model,
          options,
          request.temperature,
          context.signal,
        );
        callStats.latencyMs += call.latencyMs;
        callStats.inputTokens = (callStats.inputTokens ?? 0) + (call.inputTokens ?? 0);
        callStats.outputTokens = (callStats.outputTokens ?? 0) + (call.outputTokens ?? 0);

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
        ideas.push(stamp(draft, options.model, callStats, createdAt));
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
        failure: { kind: "empty", detail: "model repeated ideas on screen" },
        stats: totals,
      };
    }
    return { ideas, failure: null, stats: totals };
  }

  async function expand(idea: IdeaDraft, signal?: AbortSignal): Promise<Idea | null> {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt() },
      {
        role: "user",
        content:
          userPrompt({ category: idea.category, tags: idea.tags, seedTitles: [idea.title] }) +
          `\nThe idea to take further:\n  concept: ${idea.concept}\n  tension: ${idea.tension}\n  light: ${idea.light}\n  palette: ${idea.palette.join(", ")}\n  medium: ${idea.medium}\n\nMove it somewhere it could not have come from. Change the subject, not the words.`,
      },
    ];
    const call = await chat(messages, options.model, options, 1.2, signal);
    if (call.failure !== null) return null;
    const draft = parseDrafts(call.content).drafts?.[0];
    if (draft === undefined) return null;
    return stamp(
      draft,
      options.model,
      {
        latencyMs: call.latencyMs,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        validationFailures: 0,
      },
      new Date().toISOString(),
    );
  }

  return { name: "zai", generate, expand };
}

/** Vision path for the artwork mode. Kept separate from the idea provider. */
export async function analyzeArtwork(
  request: ArtworkAnalysisRequest,
  options: ZaiOptions = defaultZaiOptions,
  signal?: AbortSignal,
): Promise<ProviderOutcome> {
  if (request.image === undefined || request.image.trim().length === 0) {
    return {
      ideas: [],
      failure: { kind: "empty", detail: "no image was supplied" },
      stats: zeroStats(),
    };
  }
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: fingerprintToBrief(request.fingerprint, request.note, request.language),
        },
        { type: "image_url", image_url: { url: request.image } },
      ],
    },
  ];
  const call = await chat(messages, options.visionModel, options, 1.0, signal);
  return outcomeFromCall(call, options.visionModel, new Date().toISOString());
}

/** Re-exported so a route can require structured output without importing zod twice. */
export const zaiResponseFormat = ideaJsonSchema();
