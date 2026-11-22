import { describe, expect, it } from "vitest";

import { SEED_IDEAS } from "./corpus/seeds";
import { qualityIssues } from "./quality";
import { type IdeaDraft, IdeaDraftSchema } from "./schema";

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

  it("rejects a palette of placeholders", () => {
    const issues = qualityIssues(
      draft({ palette: ["pigment A", "pigment B", "pigment C", "pigment D"] }),
    );
    expect(issues).toHaveLength(4);
    expect(issues[0]).toBe('palette: "pigment A" is a placeholder, not a pigment');
  });

  it("does not mistake a real pigment for a placeholder", () => {
    // The negative control: "pigment" alone would catch burnt sienna and ultramarine.
    const issues = qualityIssues(
      draft({ palette: ["burnt sienna", "ultramarine", "payne's grey", "raw umber"] }),
    );
    expect(issues).toEqual([]);
  });

  it("rejects a field that loops the same clause", () => {
    const clause = "materials that were already in the surface";
    const issues = qualityIssues(
      draft({ prompt: `${clause} and ${clause} so the painter sees ${clause} in the light.` }),
    );
    expect(issues.some((i) => i.startsWith("prompt:") && i.includes("repeat three times"))).toBe(
      true,
    );
  });

  it("leaves a field that merely repeats itself twice", () => {
    const issues = qualityIssues(
      draft({
        composition:
          "brass against glass, brass against glass once more, and then a third plane of cast iron",
      }),
    );
    expect(issues.some((i) => i.startsWith("composition:"))).toBe(false);
  });

  it("passes every idea in the curated corpus", () => {
    const offenders = SEED_IDEAS.filter((idea) => qualityIssues(idea).length > 0).map(
      (i) => i.title,
    );
    expect(offenders).toEqual([]);
  });
});
