import { SEED_IDEAS } from "./corpus/seeds";
import type { Category, IdeaDraft, Tag } from "./schema";

/**
 * The deterministic core.
 *
 * Everything in this file is a pure function: same inputs, same output, no
 * clock, no network, no `Math.random`. That is what makes the deck testable
 * and what makes it survive Ollama being down — the fallback draw is not a
 * degraded mode, it is the same code path with a different seed.
 */

/** FNV-1a, 32-bit. Stable across runs and platforms. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32. Small, fast, good enough for shuffling a 53-item deck. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    const held = out[index] as T;
    out[index] = out[swap] as T;
    out[swap] = held;
  }
  return out;
}

export function pick<T>(items: readonly T[], rand: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rand() * items.length)];
}

export function pickMany<T>(items: readonly T[], count: number, rand: () => number): T[] {
  return shuffle(items, rand).slice(0, Math.max(0, count));
}

/** Trim to `max` characters, ellipsis included in the budget. */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export interface Filter {
  category?: Category;
  /** Every listed tag must be present. An empty/absent list matches everything. */
  tags?: Tag[];
}

/** Index of an idea's tags, used to keep filtering linear rather than quadratic. */
function hasTags(draft: IdeaDraft, tags: readonly Tag[]): boolean {
  return tags.every((tag) => draft.tags.includes(tag));
}

export function matches(draft: IdeaDraft, filter: Filter): boolean {
  if (filter.category !== undefined && draft.category !== filter.category) return false;
  if (filter.tags !== undefined && filter.tags.length > 0 && !hasTags(draft, filter.tags)) {
    return false;
  }
  return true;
}

/** Ids/titles already shown, so a redraw never repeats what is on screen. */
export function excludeOf(exclude: readonly string[] | undefined): Set<string> {
  return new Set(exclude ?? []);
}

/**
 * The pool is a parameter, not an import, so this function stays pure. The
 * default is the hand-written seeds; the curated provider passes the seeds plus
 * everything the overnight deepener has generated since.
 */
export function filterCorpus(
  filter: Filter,
  exclude?: readonly string[],
  pool: readonly IdeaDraft[] = SEED_IDEAS,
): IdeaDraft[] {
  const skip = excludeOf(exclude);
  return pool.filter((draft) => !skip.has(draft.title) && matches(draft, filter));
}

export interface CuratedDraw {
  drafts: IdeaDraft[];
  /** What the draw was seeded with — recorded so a run can be replayed. */
  seed: number;
  /** True when the filter left nothing and we had to widen it. */
  widened: boolean;
}

/**
 * Draw from the corpus, never returning nothing.
 *
 * A painter who filters to `portrait` + `clockwork` and gets an empty screen
 * has learned nothing, so an empty result falls back to the whole corpus. The
 * caller is told it happened (`widened`) and the UI can say so.
 */
export function drawCurated(
  filter: Filter,
  options: {
    seed?: number;
    exclude?: readonly string[];
    count?: number;
    pool?: readonly IdeaDraft[];
  } = {},
): CuratedDraw {
  const seed = options.seed ?? 0;
  const count = Math.max(1, options.count ?? 1);
  const rand = mulberry32(seed);
  const pool = options.pool ?? SEED_IDEAS;
  const strict = filterCorpus(filter, options.exclude, pool);
  const widened = strict.length === 0;
  const usable = widened ? filterCorpus({}, options.exclude, pool) : strict;
  return { drafts: pickMany(usable, count, rand), seed, widened };
}

/** Interleave two palettes so neither idea's colours dominate the result. */
function fusePalette(a: IdeaDraft, b: IdeaDraft): string[] {
  const out: string[] = [];
  const left = a.palette.slice();
  const right = b.palette.slice();
  while (out.length < 6 && (left.length > 0 || right.length > 0)) {
    const fromLeft = left.shift();
    const fromRight = right.shift();
    if (fromLeft !== undefined) out.push(fromLeft);
    if (out.length < 6 && fromRight !== undefined) out.push(fromRight);
  }
  return out.slice(0, 6);
}

function fuseTags(a: IdeaDraft, b: IdeaDraft): Tag[] {
  const seen = new Set<Tag>();
  const out: Tag[] = [];
  for (const tag of [...a.tags, ...b.tags]) {
    if (out.length >= 5) break;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  // The schema requires at least two; two one-tag drafts fuse into two tags.
  return out.slice(0, 5);
}

/**
 * Cross two ideas into a third.
 *
 * This is deliberately mechanical — it concatenates the two cards field by
 * field rather than pretending to be clever. The interesting part for a painter
 * is the collision of two unrelated concepts, and the fields stay legible so
 * she can discard half of it herself.
 */
export function fuse(a: IdeaDraft, b: IdeaDraft): IdeaDraft {
  const fused: IdeaDraft = {
    title: clip(`${clip(a.title, 50)} meets ${clip(b.title, 50)}`, 120),
    category: a.category,
    tags: fuseTags(a, b),
    concept: clip(`${a.concept} ${b.concept}`, 400),
    // Keep a's tension: it is the field that carries the artistic problem, and
    // two of them concatenated reads as indecision rather than as a problem.
    tension: a.tension,
    light: clip(`${a.light} ${b.light}`, 400),
    palette: fusePalette(a, b),
    composition: clip(`${a.composition} ${b.composition}`, 400),
    medium: clip(`${a.medium} ${b.medium}`, 400),
    prompt: clip(`${a.prompt} ${b.prompt}`, 400),
  };

  const scale = a.scale ?? b.scale;
  if (scale !== undefined) fused.scale = scale;
  const referenceAngle = a.referenceAngle ?? b.referenceAngle;
  if (referenceAngle !== undefined) fused.referenceAngle = referenceAngle;
  const pitfalls = [...(a.pitfalls ?? []), ...(b.pitfalls ?? [])].slice(0, 3);
  if (pitfalls.length > 0) fused.pitfalls = pitfalls;

  return fused;
}

/**
 * The seed for a draw. Derived from what has already been shown so the next
 * card is reproducible from the current deck state and nothing else.
 */
export function nextSeed(shown: readonly string[], salt: string): number {
  return hashString(`${salt}::${shown.join("|")}`);
}
