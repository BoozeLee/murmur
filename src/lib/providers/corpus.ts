import { rankByBrief } from "../brief";
import { allIdeas } from "../corpus/deepened";
import { drawCurated, fuse, hashString, mulberry32, pick } from "../engine";
import type { Idea, IdeaDraft } from "../schema";
import type { GenerateContext, IdeaProvider, ProviderOutcome } from "./types";

/**
 * The curated corpus as a provider.
 *
 * Not a degraded path. This is the reason the app is useful with the network
 * and the GPU both switched off, and it is what every failure in the router
 * falls back to. The only thing it cannot do is invent something new.
 */

function stamp(draft: IdeaDraft, createdAt: string): Idea {
  return {
    ...draft,
    id: `corpus-${hashString(draft.title).toString(36)}`,
    source: "corpus",
    createdAt,
    promptVersion: "corpus.v1",
    toolPolicyVersion: "murmur.tools.v1",
  };
}

export const corpusProvider: IdeaProvider = {
  name: "corpus",

  async generate(context: GenerateContext): Promise<ProviderOutcome> {
    const started = Date.now();
    const createdAt = new Date().toISOString();
    const { request } = context;
    const salt = [
      request.category ?? "any",
      (request.tags ?? []).join(","),
      request.brief ?? "",
      String(request.temperature),
      context.taskClass,
    ].join("|");
    const filter = {
      ...(request.category === undefined ? {} : { category: request.category }),
      ...(request.tags === undefined ? {} : { tags: request.tags }),
    };
    const baseSeed = hashString(salt + context.excludeTitles.join("|"));
    // A brief narrows the pool before the seeded shuffle. Ranking is stable, so
    // the same words always favour the same cards; the shuffle still makes a
    // second draw differ.
    const wholePool = allIdeas();
    const pool =
      request.brief === undefined || request.brief.trim().length === 0
        ? wholePool
        : rankByBrief(wholePool, request.brief).slice(0, 12);

    const ideas: Idea[] = [];
    const seen = new Set(context.excludeTitles);

    // The seed advances per iteration so a `count: 4` draw is four different
    // cards rather than one card re-derived four times.
    for (let index = 0; index < request.count; index += 1) {
      const draw = drawCurated(filter, {
        seed: baseSeed + index * 7919,
        exclude: [...seen],
        count: 1,
        pool,
      });
      const draft = draw.drafts[0];
      if (draft === undefined) break;
      ideas.push(stamp(draft, createdAt));
      seen.add(draft.title);
    }

    if (ideas.length === 0) {
      return {
        ideas: [],
        failure: { kind: "empty", detail: "every matching corpus idea was already shown" },
        stats: {
          latencyMs: Date.now() - started,
          inputTokens: 0,
          outputTokens: 0,
          validationFailures: 0,
        },
      };
    }

    return {
      ideas,
      failure: null,
      stats: {
        latencyMs: Date.now() - started,
        inputTokens: 0,
        outputTokens: 0,
        validationFailures: 0,
      },
    };
  },

  async expand(idea: IdeaDraft): Promise<Idea | null> {
    const rand = mulberry32(hashString(idea.title));
    // Read once: a fusion needs a single consistent pool.
    const others = allIdeas().filter((other) => other.title !== idea.title);
    const partner = pick(others, rand);
    if (partner === undefined) return null;
    const fused = fuse(idea, partner);
    return {
      ...fused,
      id: `fuse-${hashString(fused.title).toString(36)}`,
      source: "corpus",
      createdAt: new Date().toISOString(),
      promptVersion: "corpus.fuse.v1",
      toolPolicyVersion: "murmur.tools.v1",
    };
  },
};
