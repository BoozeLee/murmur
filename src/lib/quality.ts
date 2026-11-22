import type { IdeaDraft } from "./schema";

/** Openers that mean the model filled the field with a caption, not an instruction. */
const BANNED_OPENERS = ["capture", "a painting of", "an image of", "this painting"] as const;

/**
 * "pigment A", "colour 2", "swatch C". A model that has stopped thinking still has
 * to satisfy `palette: an array of 3 to 6 strings`, and the cheapest way is to
 * enumerate the schema's own words. Tight on purpose: a real pigment is never
 * "pigment" followed by a single letter or a small integer.
 */
const PLACEHOLDER_PIGMENT = /^(?:pigment|colou?r|paint|swatch)\s+(?:[a-d]|[1-4]|[ivx]+)$/i;

/** Free-text fields a model can degenerate in. The title and tags cannot. */
const PROSE_FIELDS = ["concept", "tension", "light", "composition", "medium", "prompt"] as const;

/**
 * The same five or six words, three times over.
 *
 * A damaged quant does not usually emit nonsense — it emits the same clause on
 * a loop, which passes every length rule in the schema. Observed verbatim from
 * the 2-bit quant: "materials that were already in the surface—" five times
 * inside one easel line. Five words is short enough to catch a stuck loop and
 * long enough that no hand-written card trips it.
 */
function repeatedClause(text: string, words = 5, limit = 3): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < words * limit) return null;
  const seen = new Map<string, number>();
  for (let i = 0; i + words <= tokens.length; i += 1) {
    const key = tokens.slice(i, i + words).join(" ");
    const count = (seen.get(key) ?? 0) + 1;
    if (count >= limit) return key;
    seen.set(key, count);
  }
  return null;
}

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

  for (const item of draft.palette) {
    if (PLACEHOLDER_PIGMENT.test(item.trim())) {
      issues.push(`palette: "${item}" is a placeholder, not a pigment`);
    }
  }

  for (const field of PROSE_FIELDS) {
    const loop = repeatedClause(draft[field]);
    if (loop !== null) {
      issues.push(`${field}: the same words repeat three times ("${loop}")`);
    }
  }

  return issues;
}
