import type { Category, IdeaDraft, Tag } from "./schema";
import { CATEGORIES, TAGS } from "./schema";

/**
 * A brief is a hint, not a second schema.
 *
 * The painter types a few words and we do two cheap, deterministic things:
 * turn recognisable words into the app's closed tag vocabulary, and rank the
 * curated shelf by literal overlap. Nothing here calls a model. If the words
 * are unfamiliar, the brief still reaches the model path unchanged — it just
 * cannot steer the curated draw.
 */

export const MAX_BRIEF_LENGTH = 500;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "de",
  "het",
  "een",
  "en",
  "of",
  "van",
  "with",
  "mit",
  "for",
  "in",
  "on",
  "at",
  "the",
  "is",
  "are",
  "some",
  "iets",
  "een",
  "dat",
  "die",
  "wat",
  "how",
  "about",
  "over",
  "bij",
  "tot",
]);

/** Words the closed vocabulary does not use but a painter plausibly would. */
const SYNONYMS: Record<string, Tag> = {
  kerk: "cathedral",
  church: "cathedral",
  kathedraal: "cathedral",
  tempel: "cathedral",
  temple: "cathedral",
  nacht: "nocturnal",
  night: "nocturnal",
  donker: "shadow",
  dark: "shadow",
  licht: "radiant",
  light: "radiant",
  lichtval: "chiaroscuro",
  machine: "machine",
  machineachtig: "mechanical",
  mechanisch: "mechanical",
  clock: "clockwork",
  klok: "clockwork",
  uurwerk: "clockwork",
  sterren: "astronomic",
  stars: "astronomic",
  ster: "celestial",
  star: "celestial",
  maan: "celestial",
  moon: "celestial",
  droom: "dream",
  dream: "dream",
  herinnering: "memory",
  memory: "memory",
  verval: "decay",
  decay: "decay",
  ruine: "ruin",
  ruin: "ruin",
  bloem: "flora",
  flower: "flora",
  botanisch: "botanical",
  botanical: "botanical",
  plant: "flora",
  water: "underwater",
  zee: "submerged",
  sea: "submerged",
  ocean: "submerged",
  symmetrie: "symmetry",
  symmetry: "symmetry",
  geometrie: "geometric",
  geometry: "geometric",
  architektuur: "architecture",
  architectuur: "architecture",
  architecture: "architecture",
  techniek: "engineering",
  engineering: "engineering",
  constructie: "engineered",
  structure: "engineered",
  spook: "ghost",
  ghost: "ghost",
  mysterie: "mystery",
  mystery: "mystery",
  mystiek: "mystic",
  mystic: "mystic",
  esoterisch: "esoteric",
  esoteric: "esoteric",
  vuur: "radiant",
  fire: "radiant",
  mist: "atmospheric",
  fog: "atmospheric",
  weer: "weather",
  weather: "weather",
  storm: "weather",
  kleur: "chromatic",
  colour: "chromatic",
  color: "chromatic",
};

const CATEGORY_WORDS: Record<string, Category> = {
  landschap: "landscape",
  landscape: "landscape",
  portret: "portrait",
  portrait: "portrait",
  abstract: "abstract",
  abstrakt: "abstract",
  figuratief: "figurative",
  figurative: "figurative",
  illustratie: "illustration",
  illustration: "illustration",
  stilleven: "still-life",
  still: "still-life",
};

const TAG_SET = new Set<string>(TAGS);
const CATEGORY_SET = new Set<string>(CATEGORIES);

export function normaliseBrief(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_BRIEF_LENGTH);
}

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
}

export function briefToTags(brief: string, limit = 3): Tag[] {
  const found: Tag[] = [];
  const seen = new Set<Tag>();
  for (const token of tokens(brief)) {
    const normalised = token.replace(/-/g, "");
    const direct = TAGS.find((tag) => tag === token || tag.replace(/-/g, "") === normalised);
    const candidate = direct ?? SYNONYMS[token];
    if (candidate === undefined || seen.has(candidate)) continue;
    seen.add(candidate);
    found.push(candidate);
    if (found.length >= limit) break;
  }
  return found;
}

export function briefToCategory(brief: string): Category | undefined {
  for (const token of tokens(brief)) {
    const category = CATEGORY_WORDS[token];
    if (category !== undefined && CATEGORY_SET.has(category)) return category;
  }
  return undefined;
}

/** Words worth matching against card prose, with stop words removed. */
export function briefTerms(brief: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens(brief)) {
    if (token.length < 3 || STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Stable ranking: equal scores keep corpus order, so the same brief and the
 * same shelf always produce the same draw. The caller still uses a seeded
 * shuffle among the top matches, so a second draw is not identical.
 */
export function rankByBrief(drafts: readonly IdeaDraft[], brief: string): IdeaDraft[] {
  const cleaned = normaliseBrief(brief);
  if (cleaned.length === 0) return [...drafts];
  const tags = briefToTags(cleaned);
  const category = briefToCategory(cleaned);
  const terms = briefTerms(cleaned);
  return drafts
    .map((draft, index) => {
      let score = 0;
      for (const tag of tags) if (draft.tags.includes(tag)) score += 3;
      if (category !== undefined && draft.category === category) score += 4;
      const haystack = [draft.title, draft.concept, draft.tension, draft.prompt, ...draft.palette]
        .join(" ")
        .toLowerCase();
      for (const term of terms) if (haystack.includes(term)) score += 1;
      return { draft, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.draft);
}

export function briefTagsAreValid(tags: readonly Tag[]): boolean {
  return tags.every((tag) => TAG_SET.has(tag));
}
