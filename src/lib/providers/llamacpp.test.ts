import { describe, expect, it } from "vitest";
import { createLlamacppProvider } from "./llamacpp";
import { defaultLlamacppOptions } from "./llamacpp";
import { GenerateRequestSchema, IdeaDraftSchema, ideaJsonSchema } from "../schema";
import type { IdeaDraft } from "../schema";
import type { GenerateContext } from "./types";

/**
 * These tests stub `fetch`, so they prove the provider's own logic — the request
 * it builds, the gate it applies, how it reports a failure — without a GPU. That
 * the server actually answers is measured separately against the real model.
 */

const DRAFT: IdeaDraft = IdeaDraftSchema.parse({
  title: "The Foundry That Waits For a Shape",
  category: "abstract",
  tags: ["engineered", "mystic"],
  concept:
    "A machine hall built to cast objects nobody has imagined yet, its moulds empty and cooling.",
  tension: "Precision against patience — the hall is built to make a thing that does not exist yet.",
  light: "One sodium lamp at the far end, everything else lit by the glow of cold metal.",
  palette: ["cold iron", "sodium orange", "verdigris"],
  composition: "One-point perspective down the casting aisle, moulds receding left and right.",
  medium: "Acrylic and cold wax on board",
  prompt:
    "Stand at the mouth of a casting hall whose moulds are all empty, one sodium lamp burning at the far end, and let the glow of cooling metal be the only other light there is.",
});

interface StreamShape {
  finishReason?: string | null;
  usage?: { prompt_tokens: number; completion_tokens: number } | null;
}

/**
 * llama.cpp answers this endpoint as server-sent events, and the provider reads
 * them line by line, so the stubs have to speak SSE rather than one JSON blob.
 * `parts` splits the answer across several events the way a real stream does.
 */
function sseBody(content: string, over: StreamShape = {}, parts = 1): string {
  const usage = over.usage === undefined ? { prompt_tokens: 480, completion_tokens: 210 } : over.usage;
  const size = Math.max(1, Math.ceil(content.length / parts));
  const slices = [...content.matchAll(new RegExp(`.{1,${size}}`, "gs"))].map((m) => m[0]);
  const events = slices.map(
    (slice) => `data: ${JSON.stringify({ choices: [{ delta: { content: slice }, finish_reason: null }] })}`,
  );
  events.push(
    `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: over.finishReason ?? "stop" }],
      usage,
    })}`,
  );
  events.push("data: [DONE]");
  return `${events.join("\n")}\n\n`;
}

function context(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return {
    request: GenerateRequestSchema.parse({ count: 1, temperature: 1.1 }),
    seeds: [],
    excludeTitles: [],
    taskClass: "corpus.deepen",
    ...overrides,
  };
}

const provider = createLlamacppProvider(defaultLlamacppOptions);

function stubFetch(...bodies: string[]): { calls: unknown[] } {
  const calls: unknown[] = [];
  let index = 0;
  globalThis.fetch = (async (_url: unknown, init: unknown) => {
    calls.push(JSON.parse((init as { body: string }).body));
    const body = bodies[Math.min(index, bodies.length - 1)];
    index += 1;
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  return { calls };
}

describe("llamacpp provider", () => {
  it("reports the tokens the server counted", async () => {
    stubFetch(sseBody(JSON.stringify(DRAFT)));
    const outcome = await provider.generate(context());

    expect(outcome.failure).toBeNull();
    expect(outcome.ideas).toHaveLength(1);
    expect(outcome.stats.inputTokens).toBe(480);
    expect(outcome.stats.outputTokens).toBe(210);
    expect(outcome.ideas[0]?.source).toBe("corpus");
    expect(outcome.ideas[0]?.provider).toBe("llamacpp");
  });

  it("constrains the model with the same schema the Ollama path uses", async () => {
    const { calls } = stubFetch(sseBody(JSON.stringify(DRAFT)));
    await provider.generate(context());

    const sent = calls[0] as { response_format: { json_schema: { schema: unknown } } };
    expect(sent.response_format.json_schema.schema).toEqual(ideaJsonSchema());
  });

  it("turns thinking off so it cannot spend the output budget on reasoning", async () => {
    const { calls } = stubFetch(sseBody(JSON.stringify(DRAFT)));
    await provider.generate(context());

    const sent = calls[0] as { chat_template_kwargs: { enable_thinking: boolean } };
    expect(sent.chat_template_kwargs.enable_thinking).toBe(false);
  });

  it("repairs one schema failure and returns the repaired card", async () => {
    const { calls } = stubFetch(
      sseBody(JSON.stringify({ title: "incomplete" })),
      sseBody(JSON.stringify(DRAFT)),
    );
    const outcome = await provider.generate(context());

    expect(calls).toHaveLength(2);
    expect(outcome.stats.validationFailures).toBe(1);
    expect(outcome.failure).toBeNull();
    expect(outcome.ideas[0]?.title).toBe(DRAFT.title);
  });

  it("rejects an easel line that only restates the title", async () => {
    const echo = { ...DRAFT, prompt: DRAFT.title.toLowerCase() };
    const { calls } = stubFetch(
      sseBody(JSON.stringify(echo)),
      sseBody(JSON.stringify(DRAFT)),
    );
    await provider.generate(context());

    const repair = calls[1] as { messages: { content: string }[] };
    expect(repair.messages.at(-1)?.content).toContain("repeats the title");
  });

  it("does not retry output that hit the token ceiling", async () => {
    const { calls } = stubFetch(
      sseBody('{"title":"cut off', { finishReason: "length", usage: { prompt_tokens: 480, completion_tokens: 1200 } }),
    );
    const outcome = await provider.generate(context());

    expect(calls).toHaveLength(1);
    expect(outcome.failure?.kind).toBe("malformed");
    expect(outcome.failure?.detail).toContain("token ceiling");
  });

  it("names a still-loading server instead of calling it a fault", async () => {
    globalThis.fetch = (async () =>
      new Response("loading", { status: 503, statusText: "Service Unavailable" })) as typeof fetch;
    const outcome = await provider.generate(context());

    expect(outcome.failure?.kind).toBe("provider_error");
    expect(outcome.failure?.detail).toContain("still loading");
  });

  it("refuses a title already in the corpus", async () => {
    stubFetch(sseBody(JSON.stringify(DRAFT)));
    const outcome = await provider.generate(context({ excludeTitles: [DRAFT.title] }));

    expect(outcome.failure?.kind).toBe("empty");
    expect(outcome.ideas).toHaveLength(0);
  });

  it("reassembles an answer the server trickled out in pieces", async () => {
    stubFetch(sseBody(JSON.stringify(DRAFT), {}, 40));
    const outcome = await provider.generate(context());

    expect(outcome.failure).toBeNull();
    expect(outcome.ideas[0]?.title).toBe(DRAFT.title);
    expect(outcome.stats.outputTokens).toBe(210);
  });

  it("gives up on its own deadline instead of hanging on a silent server", async () => {
    const impatient = createLlamacppProvider({ ...defaultLlamacppOptions, timeoutMs: 1200 });
    globalThis.fetch = ((_url: unknown, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const outcome = await impatient.generate(context());

    expect(outcome.failure?.kind).toBe("timeout");
    expect(outcome.failure?.detail).toContain("no card after");
  });

  it("reports a client that hangs up, not a timeout", async () => {
    const gone = AbortSignal.abort();
    globalThis.fetch = ((_url: unknown, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        if (init.signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const outcome = await provider.generate(context({ signal: gone }));

    expect(outcome.failure?.kind).toBe("aborted");
  });
});
