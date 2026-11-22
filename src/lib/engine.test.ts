import { describe, expect, it } from "vitest";
import { SEED_IDEAS } from "./corpus/seeds";
import {
  clip,
  drawCurated,
  filterCorpus,
  fuse,
  hashString,
  matches,
  mulberry32,
  nextSeed,
  pickMany,
  shuffle,
} from "./engine";
import type { IdeaDraft } from "./schema";
import { IdeaDraftSchema } from "./schema";

const anyFilter = {};

describe("hashString", () => {
  it("is stable for the same input", () => {
    expect(hashString("Cathedral Whose Buttresses Are Teeth")).toBe(
      hashString("Cathedral Whose Buttresses Are Teeth"),
    );
  });

  it("separates near-identical inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("portrait")).not.toBe(hashString("portraits"));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const input of ["", "x", "Orrery of a Dead God", "x".repeat(500)]) {
      const value = hashString(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("mulberry32", () => {
  it("produces the same stream for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).toEqual(second);
  });

  it("stays inside [0, 1)", () => {
    const rand = mulberry32(7);
    for (let index = 0; index < 5000; index += 1) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("does not immediately repeat", () => {
    const rand = mulberry32(99);
    let repeats = 0;
    let previous = rand();
    for (let index = 0; index < 500; index += 1) {
      const value = rand();
      if (value === previous) repeats += 1;
      previous = value;
    }
    expect(repeats).toBeLessThan(5);
  });
});

describe("shuffle", () => {
  const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);

  it("keeps every element", () => {
    const out = shuffle(input, mulberry32(3));
    expect(out.slice().sort((a, b) => a - b)).toEqual([...input]);
  });

  it("does not mutate its input", () => {
    shuffle(input, mulberry32(3));
    expect([...input]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("is deterministic for a given seed", () => {
    expect(shuffle(input, mulberry32(11))).toEqual(shuffle(input, mulberry32(11)));
  });

  it("actually reorders rather than returning the input", () => {
    const out = shuffle(input, mulberry32(5));
    expect(out).not.toEqual([...input]);
  });

  it("handles empty and single-element input", () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle([9], mulberry32(1))).toEqual([9]);
  });
});

describe("pickMany", () => {
  const pool = SEED_IDEAS.map((seed) => seed.title);

  it("never returns duplicates", () => {
    const out = pickMany(pool, 4, mulberry32(21));
    expect(new Set(out).size).toBe(out.length);
  });

  it("never returns more than exists", () => {
    expect(pickMany(pool, 99, mulberry32(21))).toHaveLength(pool.length);
  });

  it("returns nothing for a non-positive count", () => {
    expect(pickMany(pool, 0, mulberry32(21))).toEqual([]);
    expect(pickMany(pool, -3, mulberry32(21))).toEqual([]);
  });
});

describe("clip", () => {
  it("leaves short values alone", () => {
    expect(clip("short", 10)).toBe("short");
  });

  it("never exceeds the budget, ellipsis included", () => {
    const long = "a".repeat(500);
    for (const max of [1, 2, 5, 40, 120, 400]) {
      expect(clip(long, max).length).toBeLessThanOrEqual(max);
    }
  });
});

describe("matches", () => {
  const draft = SEED_IDEAS[0]!;

  it("matches everything under an empty filter", () => {
    expect(matches(draft, anyFilter)).toBe(true);
    expect(matches(draft, { tags: [] })).toBe(true);
  });

  it("matches on category", () => {
    expect(matches(draft, { category: draft.category })).toBe(true);
    const other = draft.category === "landscape" ? "portrait" : "landscape";
    expect(matches(draft, { category: other })).toBe(false);
  });

  it("requires every listed tag, not any of them", () => {
    expect(matches(draft, { tags: [draft.tags[0]!] })).toBe(true);
    expect(matches(draft, { tags: [draft.tags[0]!, draft.tags[1]!] })).toBe(true);
    expect(matches(draft, { tags: [draft.tags[0]!, "bioluminescent"] })).toBe(false);
  });

  it("is a conjunction of category and tags", () => {
    expect(matches(draft, { category: draft.category, tags: [draft.tags[0]!] })).toBe(true);
    expect(matches(draft, { category: "portrait", tags: [draft.tags[0]!] })).toBe(false);
  });
});

describe("filterCorpus", () => {
  it("returns the whole corpus unfiltered", () => {
    expect(filterCorpus(anyFilter)).toHaveLength(SEED_IDEAS.length);
  });

  it("never returns an idea that does not match", () => {
    const out = filterCorpus({ category: "still-life" });
    expect(out.length).toBeGreaterThan(0);
    for (const draft of out) expect(draft.category).toBe("still-life");
  });

  it("excludes by title", () => {
    const first = SEED_IDEAS[0]!;
    const out = filterCorpus(anyFilter, [first.title]);
    expect(out.map((draft) => draft.title)).not.toContain(first.title);
    expect(out).toHaveLength(SEED_IDEAS.length - 1);
  });

  it("can legitimately return nothing", () => {
    expect(filterCorpus({ category: "portrait", tags: ["vaporwave"] })).toEqual([]);
  });
});

describe("drawCurated", () => {
  it("never returns nothing, even for an impossible filter", () => {
    const draw = drawCurated({ category: "portrait", tags: ["vaporwave"] }, { seed: 1 });
    expect(draw.drafts.length).toBeGreaterThan(0);
    expect(draw.widened).toBe(true);
  });

  it("reports widening only when the strict pool was empty", () => {
    const possible = drawCurated({ category: "landscape" }, { seed: 1 });
    expect(possible.widened).toBe(false);
    expect(possible.drafts.every((draft) => draft.category === "landscape")).toBe(true);
  });

  it("is reproducible from its seed", () => {
    const a = drawCurated(anyFilter, { seed: 1234, count: 3 });
    const b = drawCurated(anyFilter, { seed: 1234, count: 3 });
    expect(a.drafts).toEqual(b.drafts);
  });

  it("draws without repeats inside one call", () => {
    const draw = drawCurated(anyFilter, { seed: 9, count: 4 });
    expect(new Set(draw.drafts.map((draft) => draft.title)).size).toBe(4);
  });

  it("respects the exclusion list", () => {
    const seen = SEED_IDEAS.slice(0, 30).map((seed) => seed.title);
    const draw = drawCurated(anyFilter, { seed: 4, exclude: seen });
    expect(draw.drafts.length).toBeGreaterThan(0);
    for (const draft of draw.drafts) expect(seen).not.toContain(draft.title);
  });

  it("emits drafts that satisfy the model contract", () => {
    const draw = drawCurated(anyFilter, { seed: 77, count: 4 });
    for (const draft of draw.drafts) {
      expect(IdeaDraftSchema.safeParse(draft).success).toBe(true);
    }
  });
});

describe("fuse", () => {
  const a = SEED_IDEAS[0]!;
  const b = SEED_IDEAS[25]!;

  it("produces something the model contract accepts", () => {
    const result = IdeaDraftSchema.safeParse(fuse(a, b));
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
    expect(result.success).toBe(true);
  });

  it("keeps a's tension rather than concatenating both", () => {
    expect(fuse(a, b).tension).toBe(a.tension);
  });

  it("stays inside the palette bound", () => {
    const palette = fuse(a, b).palette;
    expect(palette.length).toBeGreaterThanOrEqual(3);
    expect(palette.length).toBeLessThanOrEqual(6);
    for (const colour of palette) expect(colour.length).toBeLessThanOrEqual(40);
  });

  it("stays inside the tag bound and keeps at least two", () => {
    const tags = fuse(a, b).tags;
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("carries over optional fields when present", () => {
    const result = fuse(a, b);
    expect(result.scale).toBeDefined();
  });

  it("survives fusing a draft with one that has no optional fields", () => {
    const bare: IdeaDraft = {
      title: "Bare Idea",
      category: "abstract",
      tags: ["monochrome", "shadow"],
      concept: "A single flat shape.",
      tension: "Nothing to add.",
      light: "Even.",
      palette: ["black", "grey", "white"],
      composition: "Centred.",
      medium: "Acrylic.",
      prompt: "One flat shape on grey.",
    };
    const result = IdeaDraftSchema.safeParse(fuse(a, bare));
    expect(result.success).toBe(true);
    const reversed = IdeaDraftSchema.safeParse(fuse(bare, a));
    expect(reversed.success).toBe(true);
  });

  it("is commutative in validity if not in content", () => {
    expect(IdeaDraftSchema.safeParse(fuse(a, b)).success).toBe(
      IdeaDraftSchema.safeParse(fuse(b, a)).success,
    );
  });
});

describe("nextSeed", () => {
  it("changes as the deck fills and is stable for a given deck", () => {
    const empty = nextSeed([], "deck");
    const oneCard = nextSeed(["A"], "deck");
    expect(oneCard).not.toBe(empty);
    expect(nextSeed(["A"], "deck")).toBe(oneCard);
  });

  it("depends on the salt, so two decks do not march together", () => {
    expect(nextSeed(["A"], "deck")).not.toBe(nextSeed(["A"], "other"));
  });
});

describe("the corpus itself", () => {
  it("is not empty and has no duplicate titles", () => {
    expect(SEED_IDEAS.length).toBeGreaterThan(40);
    const titles = SEED_IDEAS.map((seed) => seed.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("contains only contract-valid drafts", () => {
    for (const seed of SEED_IDEAS) {
      const parsed = IdeaDraftSchema.safeParse(seed);
      if (!parsed.success) {
        throw new Error(`${seed.title}: ${JSON.stringify(parsed.error.issues)}`);
      }
    }
  });
});
