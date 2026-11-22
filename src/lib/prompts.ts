/**
 * Versioned prompts.
 *
 * Two rules from the architecture report are load-bearing here:
 *  - Routing policy lives in code (`router.ts`), never in prose. Nothing in
 *    this file tells the model to be private or local.
 *  - Prompt changes are versioned, and the version is stamped onto every idea
 *    so a bad idea can be traced back to the exact text that produced it.
 */
import { MOOD, PILLARS } from "./vocabulary";

export type { Pillar } from "./vocabulary";
export { MOOD, PILLARS } from "./vocabulary";

export const PROMPT_VERSION = "2026-10-03.2";
export const TOOL_POLICY_VERSION = "murmur.tools.v1";

const FIELD_RULES = [
  "title: two to four words. A noun phrase, not a sentence, not a mood.",
  "concept: what is physically in front of her. Concrete objects and a situation.",
  "tension: the one artistic problem that makes this idea non-obvious. This is the most important field. Never describe the concept back to her.",
  "light: where the light comes from and what it is doing. One source, described.",
  "palette: three to six colours or materials, each a plain phrase.",
  "composition: how it is arranged on the surface. Name positions and edges.",
  "medium: paint, surface, and technique, named plainly.",
  "prompt: the instruction she reads from the easel. One or two sentences, at least fifteen words. Never restate the title, never open with 'capture' or 'a painting of'. Say what is in the frame, how it is arranged, what the light is doing, and one material.",
  "Optional, and only when they earn their place: scale (how large the subject reads), referenceAngle (what to go and look at), pitfalls (up to three ways this specific idea goes wrong).",
].join("\n");

const ANTI_GENERIC = [
  "Write like a specific painter with an obsession, not like a mood board generator.",
  "Ban: dreamlike, ethereal glow, whimsical, cozy, cinematic, trending, 'a sense of', 'evokes a feeling'.",
  "Every idea must contain something she could photograph, measure, or build a maquette of.",
  "Do not use the words surrealism, surreal, or avant-garde.",
].join("\n");

export function systemPrompt(): string {
  return [
    "You invent painting ideas for one specific painter.",
    `Her subject matter is the six pillars: ${PILLARS.join(", ")}.`,
    `Her finish: ${MOOD.join(", ")}.`,
    "Reply with the JSON object only. No prose before or after.",
  ].join("\n");
}

export interface PromptOptions {
  category?: string;
  tags?: readonly string[];
  /** Titles the model should riff on rather than repeat. */
  seedTitles?: readonly string[];
  /** A temperature hint, so consecutive ideas at one temperature differ. */
  nudge?: string;
  /** The painter's own words. Kept verbatim so the model sees her phrasing. */
  brief?: string;
  language?: "en" | "nl";
}

const NL_RULES = [
  "Schrijf alle velden in het Nederlands. Geen Engelse zinnen, ook niet in de titel.",
  "Verbied: dromerig, etherische gloed, grillig, gezellig, cinematisch, 'een gevoel van'.",
  "Gebruik niet de woorden surrealisme, surreëel of avant-garde.",
].join("\n");

export function userPrompt(options: PromptOptions): string {
  const lines: string[] = ["Invent one painting idea."];
  if (options.category !== undefined) lines.push(`Category: ${options.category}.`);
  if (options.tags !== undefined && options.tags.length > 0) {
    lines.push(`It must carry these tags: ${options.tags.join(", ")}.`);
  }
  if (options.brief !== undefined && options.brief.trim().length > 0) {
    lines.push("The painter's brief, in her own words:", options.brief.trim());
    lines.push("Take the brief seriously. Do not replace it with a generic idea.");
  }
  if (options.seedTitles !== undefined && options.seedTitles.length > 0) {
    lines.push(
      "Riff on these, do not repeat them:",
      ...options.seedTitles.map((title) => `- ${title}`),
    );
  }
  if (options.nudge !== undefined) lines.push(options.nudge);
  lines.push("", FIELD_RULES, "", ANTI_GENERIC);
  if (options.language === "nl") lines.push("", NL_RULES);
  return lines.join("\n");
}

/**
 * Sent when the first attempt failed schema validation. Kept separate from
 * `userPrompt` so the correction is visible in the trace as its own step.
 */
export function correctionPrompt(reason: string): string {
  return [
    `That answer was rejected: ${reason}`,
    "Return the JSON object again, with every field present, correct and concrete.",
  ].join("\n");
}
