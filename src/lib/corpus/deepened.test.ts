import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEEPENED_LIMIT,
  allIdeas,
  appendDeepened,
  deepenedPath,
  generatedCount,
  loadDeepened,
} from "./deepened";
import { SEED_IDEAS } from "./seeds";
import { IdeaDraftSchema } from "../schema";
import type { IdeaDraft } from "../schema";

/**
 * The generated half of the corpus is written by an unattended job, so these
 * tests care about two things above all: a bad record can never take the corpus
 * down, and a machine can never overwrite a card a human wrote.
 */

let dir: string;
const previous = process.env.MURMUR_DATA_DIR;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "murmur-deepened-"));
  process.env.MURMUR_DATA_DIR = dir;
});

afterEach(() => {
  if (previous === undefined) delete process.env.MURMUR_DATA_DIR;
  else process.env.MURMUR_DATA_DIR = previous;
  rmSync(dir, { recursive: true, force: true });
});

const meta = { generatedAt: "2026-10-04T04:23:00.000Z", model: "glm-iq3_xs" };

function draft(title: string): IdeaDraft {
  return IdeaDraftSchema.parse({
    title,
    category: "abstract",
    tags: ["mechanical", "mystic"],
    concept: `A room built around ${title}, waiting for something that has not arrived.`,
    tension: "Precision against patience, with nothing yet to be precise about.",
    light: "One lamp above the doorway and a second somewhere out of sight.",
    palette: ["cold iron", "sodium orange", "verdigris"],
    composition: "One-point perspective, the subject centred and slightly too close.",
    medium: "Acrylic and cold wax on board",
    prompt:
      "Stand inside a room built around one object, lit by a single lamp above the doorway, and let the second light stay out of sight so the shadows do the describing.",
  });
}

describe("deepened corpus", () => {
  it("starts empty and reads as no generated cards", () => {
    expect(loadDeepened()).toEqual([]);
    expect(generatedCount()).toBe(0);
    expect(allIdeas()).toHaveLength(SEED_IDEAS.length);
  });

  it("adds a card and finds it again", () => {
    const result = appendDeepened([draft("Mould Room")], meta);
    expect(result.added).toHaveLength(1);

    const [card] = loadDeepened();
    expect(card?.idea.title).toBe("Mould Room");
    expect(card?.model).toBe("glm-iq3_xs");
    expect(card?.generatedAt).toBe(meta.generatedAt);
    expect(allIdeas()).toHaveLength(SEED_IDEAS.length + 1);
  });

  it("refuses a title a human already wrote", () => {
    const result = appendDeepened([draft(SEED_IDEAS[0]!.title)], meta);

    expect(result.added).toHaveLength(0);
    expect(result.duplicates).toEqual([SEED_IDEAS[0]!.title]);
    expect(loadDeepened()).toHaveLength(0);
  });

  it("refuses a title an earlier night already wrote, whatever its case", () => {
    appendDeepened([draft("Mould Room")], meta);
    const result = appendDeepened([draft("  mould ROOM ")], meta);

    expect(result.added).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(loadDeepened()).toHaveLength(1);
  });

  it("keeps earlier cards when a later run adds more", () => {
    appendDeepened([draft("Mould Room")], meta);
    appendDeepened([draft("Casting Hall")], meta);

    expect(loadDeepened().map((card) => card.idea.title)).toEqual([
      "Mould Room",
      "Casting Hall",
    ]);
  });

  it("drops records that no longer satisfy the contract instead of failing", () => {
    appendDeepened([draft("Mould Room")], meta);
    const path = deepenedPath();
    const kept = JSON.parse(readFileSync(path, "utf8")) as unknown[];
    writeFileSync(
      path,
      JSON.stringify([
        ...kept,
        { title: "No Body", category: "abstract" },
        "not an object",
        { ...draft("Casting Hall"), palette: ["only one colour"] },
        draft("Pattern Book"),
      ]),
      "utf8",
    );

    const loaded = loadDeepened();
    expect(loaded.map((card) => card.idea.title)).toEqual(["Mould Room", "Pattern Book"]);
  });

  it("reads an empty or absent file as nothing generated", () => {
    expect(loadDeepened()).toEqual([]);
    mkdirSync(join(dir, "corpus"), { recursive: true });
    writeFileSync(deepenedPath(), "[]", "utf8");
    expect(loadDeepened()).toEqual([]);
  });

  it("leaves no temporary file behind", () => {
    appendDeepened([draft("Mould Room")], meta);
    const files = readdirSync(join(dir, "corpus"));

    expect(files).toEqual(["deepened.json"]);
  });

  it("stops growing at the limit instead of writing forever", () => {
    // The ceiling is on the whole drawable pool, seeds included, so the seeds
    // already occupy part of it.
    const filler = DEEPENED_LIMIT - SEED_IDEAS.length + 3;
    const many = Array.from({ length: filler }, (_, index) => draft(`Filler ${index}`));
    const result = appendDeepened(many, meta);

    expect(result.added).toHaveLength(DEEPENED_LIMIT - SEED_IDEAS.length);
    expect(result.overLimit).toHaveLength(3);
    expect(loadDeepened()).toHaveLength(DEEPENED_LIMIT - SEED_IDEAS.length);
    expect(allIdeas()).toHaveLength(DEEPENED_LIMIT);
  });
});
