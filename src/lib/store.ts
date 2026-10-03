import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { IdeaSchema, type Idea } from "./schema";

/**
 * The durable layer, deliberately the dumbest one that can work. One painter,
 * one machine, three small JSON files — a database would add a service to run,
 * a schema to migrate and a credential to leak for no query we cannot already
 * answer in memory. The Store interface exists so that swapping this for
 * Postgres later touches exactly one file.
 */

export interface SavedIdea {
  idea: Idea;
  savedAt: string;
}

export interface StoreStats {
  saved: number;
  dismissed: number;
  seen: number;
}

export interface Store {
  listSaved(): Promise<SavedIdea[]>;
  save(idea: Idea): Promise<void>;
  unsave(id: string): Promise<void>;
  isSaved(id: string): Promise<boolean>;
  listDismissed(): Promise<string[]>;
  dismiss(title: string): Promise<void>;
  undismiss(title: string): Promise<void>;
  /** Titles already surfaced on the deck, so the next draw can avoid them. */
  listSeen(): Promise<string[]>;
  markSeen(titles: string[]): Promise<void>;
  stats(): Promise<StoreStats>;
}

const DEFAULT_DIR = join(process.cwd(), ".data");
const DISMISS_LIMIT = 500;
const SEEN_LIMIT = 1000;

/** Newest first — the card she is working from today is at the top. */
function bySavedAtDesc(a: SavedIdea, b: SavedIdea): number {
  return b.savedAt.localeCompare(a.savedAt);
}

class FileStore implements Store {
  readonly #dir: string;
  readonly #pending: Map<string, Promise<unknown>>;

  constructor(dir: string) {
    this.#dir = dir;
    this.#pending = new Map();
  }

  #path(name: string): string {
    return join(this.#dir, `${name}.json`);
  }

  /**
   * One in-flight operation per file. Concurrent draws each save at the same
   * time, and an unsynchronised read-modify-write on a shared file is how a
   * JSON store silently loses an idea. Strictly non-reentrant: the loaders
   * below are the unqueued primitives, so nothing ever waits on itself.
   */
  #serialise<T>(name: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#pending.get(name) ?? Promise.resolve();
    const next = previous.then(work, work);
    this.#pending.set(
      name,
      next.catch(() => undefined),
    );
    return next;
  }

  async #load<T>(name: string, fallback: T, validate?: (value: unknown) => T): Promise<T> {
    let raw: string;
    try {
      raw = await readFile(this.#path(name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`murmur: cannot read ${name}: ${(error as Error).message}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`murmur: ${name}.json is not valid JSON: ${(error as Error).message}`);
    }
    return validate ? validate(parsed) : (parsed as T);
  }

  /** Write-then-rename so an interrupted write cannot truncate an existing file. */
  async #write(name: string, value: unknown): Promise<void> {
    const target = this.#path(name);
    const temp = `${target}.${process.pid}.tmp`;
    await mkdir(this.#dir, { recursive: true });
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, target);
  }

  #loadSaved(): Promise<SavedIdea[]> {
    return this.#load<SavedIdea[]>("saved", [], (value) => {
      if (!Array.isArray(value)) return [];
      const kept: SavedIdea[] = [];
      for (const entry of value) {
        const candidate = entry as SavedIdea | null;
        const parsed = IdeaSchema.safeParse(candidate?.idea);
        if (parsed.success && typeof candidate?.savedAt === "string") {
          kept.push({ idea: parsed.data, savedAt: candidate.savedAt });
        }
      }
      return kept.sort(bySavedAtDesc);
    });
  }

  #loadStrings(name: string): Promise<string[]> {
    return this.#load<string[]>(name, [], (value) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [],
    );
  }

  listSaved(): Promise<SavedIdea[]> {
    return this.#serialise("saved", () => this.#loadSaved());
  }

  async save(idea: Idea): Promise<void> {
    const validated = IdeaSchema.parse(idea);
    await this.#serialise("saved", async () => {
      const current = await this.#loadSaved();
      const existing = current.find((entry) => entry.idea.id === validated.id);
      // Re-saving keeps the first timestamp: savedAt records when she decided,
      // not when the file was last touched.
      const next: SavedIdea[] = [
        { idea: validated, savedAt: existing?.savedAt ?? new Date().toISOString() },
        ...current.filter((entry) => entry.idea.id !== validated.id),
      ];
      await this.#write("saved", next);
    });
  }

  async unsave(id: string): Promise<void> {
    await this.#serialise("saved", async () => {
      const current = await this.#loadSaved();
      const next = current.filter((entry) => entry.idea.id !== id);
      if (next.length === current.length) return;
      await this.#write("saved", next);
    });
  }

  async isSaved(id: string): Promise<boolean> {
    return (await this.listSaved()).some((entry) => entry.idea.id === id);
  }

  listDismissed(): Promise<string[]> {
    return this.#serialise("dismissed", () => this.#loadStrings("dismissed"));
  }

  async dismiss(title: string): Promise<void> {
    await this.#serialise("dismissed", async () => {
      const current = await this.#loadStrings("dismissed");
      if (current.includes(title)) return;
      await this.#write("dismissed", [title, ...current].slice(0, DISMISS_LIMIT));
    });
  }

  async undismiss(title: string): Promise<void> {
    await this.#serialise("dismissed", async () => {
      const current = await this.#loadStrings("dismissed");
      const next = current.filter((item) => item !== title);
      if (next.length === current.length) return;
      await this.#write("dismissed", next);
    });
  }

  /** Newest batch first, and within a batch the order the caller supplied. */
  async markSeen(titles: string[]): Promise<void> {
    const incoming = titles.filter((title) => title.length > 0);
    if (incoming.length === 0) return;
    await this.#serialise("seen", async () => {
      const current = await this.#loadStrings("seen");
      const merged = [...new Set([...incoming, ...current])].slice(0, SEEN_LIMIT);
      await this.#write("seen", merged);
    });
  }

  listSeen(): Promise<string[]> {
    return this.#serialise("seen", () => this.#loadStrings("seen"));
  }

  async stats(): Promise<StoreStats> {
    const [saved, dismissed, seen] = await Promise.all([
      this.listSaved(),
      this.listDismissed(),
      this.listSeen(),
    ]);
    return { saved: saved.length, dismissed: dismissed.length, seen: seen.length };
  }
}

let instance: Store | undefined;

/**
 * Built lazily so importing this from a route that never touches disk does not
 * create `.data/` as a side effect.
 */
export function getStore(): Store {
  if (!instance) {
    instance = new FileStore(process.env.MURMUR_DATA_DIR ?? DEFAULT_DIR);
  }
  return instance;
}

/** Test seam: swap the store, or pass undefined to fall back to the file store. */
export function setStore(store: Store | undefined): void {
  instance = store;
}

export function createFileStore(dir: string): Store {
  return new FileStore(dir);
}