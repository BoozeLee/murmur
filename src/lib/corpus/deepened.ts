import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IdeaDraftSchema } from "../schema";
import type { IdeaDraft } from "../schema";
import { SEED_IDEAS } from "./seeds";

/**
 * The generated half of the corpus.
 *
 * The hand-written seeds in `seeds.ts` are the reviewed baseline and are never
 * written by a machine. Cards authored by the overnight model live here instead,
 * in gitignored `.data/corpus/deepened.json`, and are merged into the pool at
 * read time. Three reasons for the split:
 *
 *  - a model's output is untrusted until it has been validated, and a validated
 *    artefact is still not the same thing as a reviewed one;
 *  - the deepener runs unattended, so its output must never be able to damage the
 *    file a human wrote;
 *  - `git diff` on the seeds file therefore only ever shows human decisions.
 *
 * Everything that reads the corpus must go through `allIdeas()`, not `SEED_IDEAS`,
 * or generated cards will exist and never be drawn.
 */

const DEFAULT_DIR = join(process.cwd(), ".data");

/** Upper bound on generated cards, so a nightly job cannot grow the pool forever. */
export const DEEPENED_LIMIT = 400;

export interface DeepenedCard {
  idea: IdeaDraft;
  /** ISO timestamp of the overnight run that produced it. */
  generatedAt: string;
  /** Which model wrote it, e.g. the GGUF filename. */
  model: string;
}

interface StoredCard {
  generatedAt?: unknown;
  model?: unknown;
  // The draft's own fields are validated through IdeaDraftSchema.
  [key: string]: unknown;
}

function corpusDir(): string {
  return join(process.env.MURMUR_DATA_DIR ?? DEFAULT_DIR, "corpus");
}

export function deepenedPath(): string {
  return join(corpusDir(), "deepened.json");
}

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Read the generated cards, dropping any record that no longer satisfies the
 * contract. A file written by an older schema, or hand-edited into nonsense,
 * loses the bad rows instead of taking the whole corpus down with it — the same
 * rule the saved-ideas reader follows.
 */
export function loadDeepened(): DeepenedCard[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(deepenedPath(), "utf8"));
  } catch {
    // Missing file is the normal first-run case, not an error.
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const cards: DeepenedCard[] = [];
  for (const entry of raw as StoredCard[]) {
    if (entry === null || typeof entry !== "object") continue;
    const parsed = IdeaDraftSchema.safeParse(entry);
    if (!parsed.success) continue;
    cards.push({
      idea: parsed.data,
      generatedAt: typeof entry.generatedAt === "string" ? entry.generatedAt : "unknown",
      model: typeof entry.model === "string" ? entry.model : "unknown",
    });
  }
  return cards;
}

export interface AppendResult {
  added: DeepenedCard[];
  /** Rejected because the title already exists in the corpus. */
  duplicates: string[];
  /** Rejected because the pool is already at `DEEPENED_LIMIT`. */
  overLimit: string[];
}

/**
 * Add cards to the corpus, refusing anything already present.
 *
 * Duplicate titles are the failure mode worth guarding: the deepener is asked for
 * a fresh idea each night with the existing titles as exclusions, but a model can
 * still return a near-duplicate, and two cards called "Iron Cathedral" would show
 * her the same painting twice and read as a bug.
 */
export function appendDeepened(
  ideas: readonly IdeaDraft[],
  meta: { generatedAt: string; model: string },
): AppendResult {
  const existing = loadDeepened();
  const known = new Set<string>([
    ...SEED_IDEAS.map((seed) => titleKey(seed.title)),
    ...existing.map((card) => titleKey(card.idea.title)),
  ]);

  const result: AppendResult = { added: [], duplicates: [], overLimit: [] };
  for (const candidate of ideas) {
    // Callers hand over whole Ideas, provenance and all. Only the draft fields are
    // persisted — the writing model and the run's timestamp are recorded here and
    // the rest is not — so the file's shape cannot depend on which night a card
    // happened to arrive in. Stripping through the contract also means a stray
    // field can never ride along into the pool.
    const parsed = IdeaDraftSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const idea = parsed.data;
    const key = titleKey(idea.title);
    if (known.has(key)) {
      result.duplicates.push(idea.title);
      continue;
    }
    if (known.size >= DEEPENED_LIMIT) {
      result.overLimit.push(idea.title);
      continue;
    }
    known.add(key);
    result.added.push({ idea, generatedAt: meta.generatedAt, model: meta.model });
  }

  if (result.added.length === 0) return result;

  const path = deepenedPath();
  mkdirSync(corpusDir(), { recursive: true });
  // Write-temp-then-rename: an interrupted nightly write must not truncate the
  // cards that are already there.
  const temp = `${path}.${process.pid}.tmp`;
  const payload = [...existing, ...result.added].map((card) => ({
    ...card.idea,
    generatedAt: card.generatedAt,
    model: card.model,
  }));
  writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(temp, path);

  return result;
}

/**
 * Everything a draw may choose from: the reviewed seeds, then the generated
 * cards. Read fresh each call so a card written by the overnight job appears in
 * the morning without a restart.
 */
export function allIdeas(): IdeaDraft[] {
  return [...SEED_IDEAS, ...loadDeepened().map((card) => card.idea)];
}

/** How many cards came from the model, for the deck's own counters. */
export function generatedCount(): number {
  return loadDeepened().length;
}
