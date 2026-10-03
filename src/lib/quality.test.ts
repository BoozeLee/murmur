import { describe, expect, it } from "vitest";

import { SEED_IDEAS } from "./corpus/seeds";
import { qualityIssues } from "./quality";
import { IdeaDraftSchema, type IdeaDraft } from "./schema";

const SEED = SEED_IDEAS[0];
if (SEED === undefined) throw new Error("corpus is empty");
// Parsing rather than casting: if a seed ever stops satisfying the draft
// contract, this test file fails to compile instead of quietly testing a fiction.
const BASE = IdeaDraftSchema.parse(SEED);

function draft(overrides: Partial<IdeaDraft> = {}): IdeaDraft {
  return { ...BASE, ...overrides };
}

describe("qualityIssues", () => {
  it("accepts an easel line that says more than the title", () => {
    expect(qualityIssues(draft())).toEqual([]);
  });

  it("rejects an easel line that is the title again", () => {
    const title = "Iron Cathedral";
    const issues = qualityIssues(
      draft({ title, prompt: "Iron Cathedral", concept: "A foundry hall with the roof missing." }),
    );
    expect(issues).toContain("prompt: the easel line repeats the title");
  });

  it("compares after normalising case and punctuation", () => {
    const issues = qualityIssues(draft({ title: "The Escapement", prompt: "the escapement." }));
    expect(issues).toContain("prompt: the easel line repeats the title");
  });

  it("rejects a caption-length easel line that is not the title", () => {
    const issues = qualityIssues(draft({ prompt: "a moth wing at dusk" }));
    expect(issues).toEqual(["prompt: the easel line is a caption, not an instruction"]);
  });

  it("rejects a stock opener even when the line is long enough", () => {
    const issues = qualityIssues(
      draft({
        prompt:
          "Capture the interplay of light and material where the grid distorts the horizon above a sleeping machine.",
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("stock phrase");
  });

  it("passes every idea in the curated corpus", () => {
    const offenders = SEED_IDEAS.filter((idea) => qualityIssues(idea).length > 0).map((i) => i.title);
    expect(offenders).toEqual([]);
  });
});