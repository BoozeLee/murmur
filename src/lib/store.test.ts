import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Idea, IdeaSchema } from "./schema";
import { createFileStore, type Store } from "./store";

function idea(overrides: Partial<Idea> = {}): Idea {
  return IdeaSchema.parse({
    id: `corpus-${Math.random().toString(36).slice(2, 10)}`,
    title: "Cathedral Whose Buttresses Are Teeth",
    category: "abstract",
    tags: ["architectural", "esoteric"],
    concept: "A nave built from things that bite.",
    tension: "Sacred on the outside, predatory on the inside.",
    light: "Low sun through a broken rose window.",
    palette: ["bone white", "iron grey", "oxidised gold"],
    composition: "One-point perspective down the central aisle.",
    medium: "Oil on board.",
    prompt: "A cathedral whose buttresses are teeth, low sun through a broken rose window.",
    source: "corpus",
    createdAt: "2026-10-03T09:00:00.000Z",
    ...overrides,
  });
}

describe("FileStore", () => {
  let dir: string;
  let store: Store;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "murmur-store-"));
    store = createFileStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty collections before anything is written", async () => {
    await expect(store.listSaved()).resolves.toEqual([]);
    await expect(store.listDismissed()).resolves.toEqual([]);
    await expect(store.listSeen()).resolves.toEqual([]);
    await expect(store.stats()).resolves.toEqual({ saved: 0, dismissed: 0, seen: 0 });
  });

  it("saves and reads back a full idea", async () => {
    const card = idea();
    await store.save(card);
    const saved = await store.listSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.idea).toEqual(card);
    expect(await store.isSaved(card.id)).toBe(true);
  });

  it("re-saving keeps the original savedAt and does not duplicate", async () => {
    const card = idea();
    await store.save(card);
    const first = (await store.listSaved())[0]?.savedAt ?? "";
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.save({ ...card, title: "Edited title" });
    const saved = await store.listSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.idea.title).toBe("Edited title");
    expect(saved[0]?.savedAt).toBe(first);
  });

  it("orders saved ideas newest first", async () => {
    const older = idea({ id: "a" });
    const newer = idea({ id: "b" });
    await store.save(older);
    await writeFile(
      join(dir, "saved.json"),
      JSON.stringify([
        { idea: older, savedAt: "2026-10-01T00:00:00.000Z" },
        { idea: newer, savedAt: "2026-10-02T00:00:00.000Z" },
      ]),
    );
    const saved = await store.listSaved();
    expect(saved.map((entry) => entry.idea.id)).toEqual(["b", "a"]);
  });

  it("unsaves and reports absent ids as unsaved", async () => {
    const card = idea();
    await store.save(card);
    await store.unsave(card.id);
    expect(await store.isSaved(card.id)).toBe(false);
    expect(await store.listSaved()).toEqual([]);
    await expect(store.unsave("nope")).resolves.toBeUndefined();
  });

  it("rejects an idea that does not satisfy the schema", async () => {
    await expect(store.save({ id: "x" } as unknown as Idea)).rejects.toThrow();
    await expect(store.listSaved()).resolves.toEqual([]);
  });

  it("drops corrupt entries on read instead of failing the whole list", async () => {
    await writeFile(
      join(dir, "saved.json"),
      JSON.stringify([{ idea: { id: "broken" }, savedAt: "2026-10-01T00:00:00.000Z" }]),
    );
    await expect(store.listSaved()).resolves.toEqual([]);
  });

  it("keeps every concurrent save — the race the serialiser exists for", async () => {
    const cards = Array.from({ length: 12 }, (_, index) => idea({ id: `idea-${index}` }));
    await Promise.all(cards.map((card) => store.save(card)));
    const saved = await store.listSaved();
    expect(saved).toHaveLength(12);
    expect(new Set(saved.map((entry) => entry.idea.id))).toEqual(new Set(cards.map((c) => c.id)));
  });

  it("dismisses idempotently and undismisses", async () => {
    await store.dismiss("Orrery of a Dead God");
    await store.dismiss("Orrery of a Dead God");
    expect(await store.listDismissed()).toEqual(["Orrery of a Dead God"]);
    await store.undismiss("Orrery of a Dead God");
    expect(await store.listDismissed()).toEqual([]);
    await expect(store.undismiss("never there")).resolves.toBeUndefined();
  });

  it("records seen titles with the newest batch first, deduplicated", async () => {
    await store.markSeen(["first", "second"]);
    await store.markSeen(["second", "third"]);
    expect(await store.listSeen()).toEqual(["second", "third", "first"]);
    await expect(store.markSeen([])).resolves.toBeUndefined();
  });

  it("caps the dismissed and seen lists", async () => {
    await store.markSeen(Array.from({ length: 1200 }, (_, index) => `t${index}`));
    expect((await store.listSeen()).length).toBe(1000);
    await store.dismiss("seed");
    for (let index = 0; index < 600; index += 1) await store.dismiss(`title-${index}`);
    expect((await store.listDismissed()).length).toBeLessThanOrEqual(500);
  });

  it("survives a restart: a second store over the same directory sees the data", async () => {
    const card = idea();
    await store.save(card);
    await store.markSeen([card.title]);
    await store.dismiss("something else");

    const reopened = createFileStore(dir);
    expect((await reopened.listSaved())[0]?.idea.id).toBe(card.id);
    expect(await reopened.listSeen()).toEqual([card.title]);
    expect(await reopened.listDismissed()).toEqual(["something else"]);
  });

  it("reports corrupt JSON with the file name rather than a bare SyntaxError", async () => {
    await writeFile(join(dir, "seen.json"), "{not json");
    await expect(store.listSeen()).rejects.toThrow(/seen\.json is not valid JSON/);
  });

  it("writes newline-terminated JSON", async () => {
    await store.save(idea());
    const raw = await readFile(join(dir, "saved.json"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(raw) as unknown).not.toThrow();
  });
});
