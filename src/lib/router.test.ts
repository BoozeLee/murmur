import { afterEach, describe, expect, it } from "vitest";
import type { GenerateContext, IdeaProvider, ProviderOutcome } from "./providers/types";
import { expandIdea, POLICIES, run, setProvider } from "./router";
import type { Idea } from "./schema";
import { IdeaDraftSchema } from "./schema";

/**
 * The routing table is the product's promise that the deck and the deepener can
 * never silently disagree about which model answers. These tests pin that table
 * and the two behaviours it produces: the preferred provider is the one that is
 * asked, and a failure falls through to the corpus with the reason recorded.
 */

const draft = IdeaDraftSchema.parse({
  title: "A Test Card",
  category: "abstract",
  tags: ["geometric", "mystic"],
  concept: "Two rings that disagree about where they meet.",
  tension: "The rings cannot both be the whole shape.",
  light: "One lamp, low, from the left.",
  palette: ["oxidised copper", "cold bone", "one ember"],
  composition: "Off centre, overlapping.",
  medium: "Oil on board",
  prompt:
    "Paint two overlapping rings on a dark board, place them slightly left of centre, and light the left rim with a single low lamp so the copper reads warm against bone.",
});

function stubProvider(name: string, outcome: ProviderOutcome, calls: string[]): IdeaProvider {
  return {
    name,
    generate: async (context: GenerateContext) => {
      calls.push(`generate:${context.request.count}`);
      return outcome;
    },
    expand: async () => null,
  };
}

function okOutcome(model: string): ProviderOutcome {
  return {
    ideas: [
      {
        ...draft,
        id: `stub-${model}`,
        source: "corpus",
        createdAt: "2026-10-04T00:00:00.000Z",
        provider: "llamacpp",
        model,
        latencyMs: 12,
        promptVersion: "test",
        toolPolicyVersion: "test",
        inputTokens: 10,
        outputTokens: 20,
        fallbackUsed: false,
      },
    ],
    failure: null,
    stats: { latencyMs: 12, inputTokens: 10, outputTokens: 20, validationFailures: 0 },
  };
}

function failedOutcome(kind: "timeout" | "unreachable", detail: string): ProviderOutcome {
  return {
    ideas: [],
    failure: { kind, detail },
    stats: { latencyMs: 5, inputTokens: null, outputTokens: null, validationFailures: 0 },
  };
}

afterEach(() => {
  setProvider("llamacpp", null);
  setProvider("ollama", null);
});

describe("the routing policy table", () => {
  it("keeps every card local and every row with a corpus answer behind it", () => {
    for (const [taskClass, policy] of Object.entries(POLICIES)) {
      expect(policy.cloudFallback, taskClass).toBe(false);
      expect(policy.maxCostEur, taskClass).toBe(0);
    }
    // Only the deepener refuses the corpus, because a deepening run that
    // answered from the corpus would deepen nothing while reporting success.
    expect(POLICIES["corpus.deepen"].corpusFallback).toBe(false);
    expect(POLICIES["deck.draw"].corpusFallback).toBe(true);
    expect(POLICIES["deck.expand"].corpusFallback).toBe(true);
  });

  it("points the deck and the deepener at the llama.cpp MoE, not Ollama", () => {
    expect(POLICIES["deck.draw"].preferred).toBe("llamacpp");
    expect(POLICIES["deck.expand"].preferred).toBe("llamacpp");
    expect(POLICIES["corpus.deepen"].preferred).toBe("llamacpp");
  });

  it("caps how many cards one call may ask for", () => {
    expect(POLICIES["deck.draw"].maxCount).toBe(4);
    expect(POLICIES["deck.expand"].maxCount).toBe(1);
    expect(POLICIES["corpus.deepen"].maxCount).toBe(1);
  });
});

describe("run", () => {
  it("asks the preferred provider and reports no fallback when it answers", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", stubProvider("llamacpp", okOutcome("glm-creative"), calls));
    const result = await run("deck.draw", { count: 1 }, [], []);
    expect(calls).toEqual(["generate:1"]);
    expect(result.fallback).toBeNull();
    expect(result.telemetry.provider).toBe("llamacpp");
    expect(result.telemetry.model).toBe("glm-creative");
    expect(result.telemetry.fallbackUsed).toBe(false);
  });

  it("falls back to the corpus and names the reason when the model fails", async () => {
    const calls: string[] = [];
    setProvider(
      "llamacpp",
      stubProvider("llamacpp", failedOutcome("unreachable", "port 11436 refused"), calls),
    );
    const result = await run("deck.draw", { count: 1 }, [], []);
    expect(calls).toEqual(["generate:1"]);
    expect(result.fallback).not.toBeNull();
    expect(result.fallback?.from).toBe("llamacpp");
    expect(result.fallback?.reason).toContain("port 11436 refused");
    expect(result.telemetry.fallbackUsed).toBe(true);
    expect(result.ideas.length).toBeGreaterThan(0);
    // The corpus answer is what she sees, so it must be a real curated card.
    expect(result.ideas[0]?.source).toBe("corpus");
  });

  it("never touches the model for a curated-only request", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", stubProvider("llamacpp", okOutcome("glm-creative"), calls));
    const result = await run("deck.draw", { count: 1, curatedOnly: true }, [], []);
    expect(calls).toEqual([]);
    expect(result.telemetry.provider).toBe("corpus");
    expect(result.telemetry.fallbackUsed).toBe(false);
  });

  it("refuses a request the contract does not accept, naming the field", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", stubProvider("llamacpp", okOutcome("glm-creative"), calls));
    await expect(run("deck.draw", { count: 99 }, [], [])).rejects.toThrow(/count/);
    await expect(run("deck.draw", { category: "sculpture" }, [], [])).rejects.toThrow(/category: /);
    expect(calls).toEqual([]);
  });

  it("refuses to draw more than the policy allows for the task", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", stubProvider("llamacpp", okOutcome("glm-creative"), calls));
    await expect(run("deck.expand", { count: 3 }, [], [])).rejects.toThrow(
      /count exceeds the 1 allowed for deck.expand/,
    );
    expect(calls).toEqual([]);
  });
});

describe("expandIdea", () => {
  const modelIdea: Idea = {
    ...draft,
    id: "from-the-model",
    source: "corpus",
    createdAt: "2026-10-04T00:00:00.000Z",
  };

  /** An expand stub that records whether the model was asked at all. */
  function expandStub(name: string, expanded: Idea | null, calls: string[]): IdeaProvider {
    return {
      name,
      generate: async () => okOutcome("glm-creative"),
      expand: async () => {
        calls.push("expand");
        return expanded;
      },
    };
  }

  it("fuses with a corpus partner and never asks the model when curated", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", expandStub("llamacpp", modelIdea, calls));
    const result = await expandIdea(draft, { curatedOnly: true });
    expect(calls).toEqual([]);
    expect(result.telemetry.provider).toBe("corpus");
    // Not a fallback: it was the path asked for, so no apology is recorded.
    expect(result.fallback).toBeNull();
    expect(result.telemetry.fallbackUsed).toBe(false);
  });

  it("still asks the model when the fusion was not the choice", async () => {
    const calls: string[] = [];
    setProvider("llamacpp", expandStub("llamacpp", modelIdea, calls));
    const result = await expandIdea(draft);
    expect(calls).toEqual(["expand"]);
    expect(result.telemetry.provider).toBe("llamacpp");
  });
});
