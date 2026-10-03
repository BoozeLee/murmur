import type { IdeaDraft } from "./schema";

/** Openers that mean the model filled the field with a caption, not an instruction. */
const BANNED_OPENERS = ["capture", "a painting of", "an image of", "this painting"] as const;

/**
 * Deterministic quality rules that JSON Schema cannot express.
 *
 * A schema says "title is a string of at most 120 characters". It cannot say
 * "the easel line must not be the title again" — which is exactly the failure
 * the 8B model falls into, because restating the title is the cheapest way to
 * fill the field. A card whose prompt is its title is a card with no prompt,
 * so it is rejected here and sent back for one repair.
 */
export function qualityIssues(draft: IdeaDraft): string[] {
  const issues: string[] = [];

  const normalise = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const prompt = normalise(draft.prompt);
  if (prompt.length > 0 && prompt === normalise(draft.title)) {
    issues.push("prompt: the easel line repeats the title");
  }

  // The prompt asks for fifteen words; twelve is the floor that keeps a caption
  // out. The curated corpus clears it by a wide margin, so this only ever fires
  // on model output.
  if (draft.prompt.trim().split(/\s+/).length < 12) {
    issues.push("prompt: the easel line is a caption, not an instruction");
  }

  const opener = BANNED_OPENERS.find((phrase) => prompt.startsWith(phrase));
  if (opener !== undefined) {
    issues.push(`prompt: the easel line opens with the stock phrase "${opener}"`);
  }

  return issues;
}