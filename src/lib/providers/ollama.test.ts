import { afterEach, describe, expect, it, vi } from "vitest";

import { SEED_IDEAS } from "../corpus/seeds";
import { GenerateRequestSchema, type GenerateRequest } from "../schema";
import { createOllamaProvider, type OllamaOptions } from "./ollama";
import type { GenerateContext } from "./types";

const OPTIONS: OllamaOptions = {
  model: "test-model",
  timeoutMs: 1_000,
  maxTokens: 100,
  keepAlive: "0s",
  maxRepairs: 1,
};

const VALID = SEED_IDEAS[0];
if (VALID === undefined) throw new Error("corpus is empty");

function context(request: Partial<GenerateRequest> = {}): GenerateContext {
  return {
    request: GenerateRequestSchema.parse(request),
    seeds: [],
    excludeTitles: [],
    taskClass: "deck.draw",
  };
}

function reply(content: string, counts = { prompt_eval_count: 120, eval_count: 340 }): Response {
  return new Response(JSON.stringify({ message: { content }, ...counts, done_reason: "stop" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ollama provider", () => {
  it("reports token counts from the model, not zeros", async () => {
    const fetchMock = vi.fn(async () => reply(JSON.stringify(VALID)));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(outcome.failure).toBeNull();
    expect(outcome.ideas).toHaveLength(1);
    expect(outcome.stats.inputTokens).toBe(120);
    expect(outcome.stats.outputTokens).toBe(340);
    expect(outcome.ideas[0]?.inputTokens).toBe(120);
    expect(outcome.ideas[0]?.source).toBe("ollama");
    expect(outcome.ideas[0]?.provider).toBe("ollama");
    expect(outcome.ideas[0]?.model).toBe("test-model");
  });

  it("repairs a schema-valid card whose easel line just repeats the title", async () => {
    const lazy = { ...VALID, title: "Iron Cathedral", prompt: "iron cathedral" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(JSON.stringify(lazy)))
      .mockResolvedValueOnce(reply(JSON.stringify(VALID)));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome.failure).toBeNull();
    expect(outcome.stats.validationFailures).toBe(1);
    const repairBody = String(fetchMock.mock.calls[1]?.[1]?.body ?? "");
    expect(repairBody).toContain("repeats the title");
  });

  it("rejects the answer and asks for one informed repair", async () => {
    const bad = JSON.stringify({ ...VALID, palette: ["only-one"] });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(bad))
      .mockResolvedValueOnce(reply(JSON.stringify(VALID)));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome.failure).toBeNull();
    expect(outcome.ideas).toHaveLength(1);
    expect(outcome.stats.validationFailures).toBe(1);
    // Both legs spent tokens; the count must include the rejected one.
    expect(outcome.stats.outputTokens).toBe(680);
  });

  it("gives up as a typed failure when the repair is still invalid", async () => {
    const bad = JSON.stringify({ ...VALID, category: "sculpture" });
    vi.stubGlobal("fetch", vi.fn(async () => reply(bad)));

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(outcome.ideas).toHaveLength(0);
    expect(outcome.failure?.kind).toBe("rejected");
    expect(outcome.failure?.detail).toContain("category");
  });

  it("turns a non-2xx into provider_error rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(outcome.ideas).toHaveLength(0);
    expect(outcome.failure?.kind).toBe("provider_error");
    expect(outcome.failure?.detail).toBe("HTTP 500");
  });

  it("turns a refused connection into unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const outcome = await createOllamaProvider(OPTIONS).generate(context());

    expect(outcome.failure?.kind).toBe("unreachable");
    expect(outcome.failure?.detail).toContain("ECONNREFUSED");
  });

  it("skips a model reply that repeats a title already on screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify(VALID))));

    const outcome = await createOllamaProvider(OPTIONS).generate({
      ...context(),
      excludeTitles: [VALID.title],
    });

    expect(outcome.ideas).toHaveLength(0);
    expect(outcome.failure?.kind).toBe("empty");
  });
});