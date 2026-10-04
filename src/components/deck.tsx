"use client";

import { useCallback, useEffect, useState } from "react";

import { FilterBar, type DeckFilter } from "@/components/filter-bar";
import { IdeaCard } from "@/components/idea-card";
import type { Idea } from "@/lib/schema";
import type { SavedIdea, StoreStats } from "@/lib/store";

type Status = "idle" | "drawing" | "expanding";

interface DrawResponse {
  ideas: Idea[];
  fallback: { from: string; reason: string } | null;
  telemetry: { provider: string; model: string | null; latencyMs: number; fallbackUsed: boolean };
  modelServer?: { started: boolean; waitedMs: number } | null;
}

const EMPTY_FILTER: DeckFilter = { tags: [] };

export function Deck({
  initialSaved,
  initialStats,
  corpusSize,
}: {
  initialSaved: SavedIdea[];
  initialStats: StoreStats;
  corpusSize: number;
}): React.ReactElement {
  const [deck, setDeck] = useState<Idea[]>([]);
  const [saved, setSaved] = useState<SavedIdea[]>(initialSaved);
  const [stats, setStats] = useState<StoreStats>(initialStats);
  const [filter, setFilter] = useState<DeckFilter>(EMPTY_FILTER);
  // Curated first. The corpus is what she browses, and it answers in
  // milliseconds without the 30B MoE having to load ten gigabytes off disk.
  // The model stays reachable for the one thing the corpus cannot do — invent
  // something nobody has written down yet — but it is the opt-in, not the wait.
  const [curatedOnly, setCuratedOnly] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showShelf, setShowShelf] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialSaved.map((entry) => entry.idea.id)),
  );

  const busy = status !== "idle";

  useEffect(() => {
    if (status === "idle") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [status]);

  // `from` overrides the toggle for one call, so a button can say which source it
  // wants without waiting for a state change to land before the fetch is built.
  const draw = useCallback(
    async (from?: boolean) => {
      const curated = from ?? curatedOnly;
      setStatus("drawing");
      setError(null);
      setNote(null);
      try {
        const response = await fetch("/api/ideas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            category: filter.category,
            tags: filter.tags.length > 0 ? filter.tags : undefined,
            curatedOnly: curated,
          }),
        });
        const payload = (await response.json()) as DrawResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `request failed (${response.status})`);
        setDeck(payload.ideas);
        setNote(describe(payload));
        setStats((current) => ({ ...current, seen: current.seen + payload.ideas.length }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setStatus("idle");
      }
    },
    [curatedOnly, filter],
  );

  async function keep(idea: Idea): Promise<void> {
    const already = savedIds.has(idea.id);
    setSavedIds(
      (current) => {
        const next = new Set(current);
        if (already) next.delete(idea.id);
        else next.add(idea.id);
        return next;
      },
    );

    const response = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(already ? { id: idea.id, saved: false } : { idea }),
    });
    const payload = (await response.json()) as { saved?: SavedIdea[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "could not reach the shelf");
      return;
    }
    setSaved(payload.saved ?? []);
    setStats((current) => ({ ...current, saved: current.saved + (already ? -1 : 1) }));
    setNote(already ? "Released." : "Kept. It is on your shelf.");
  }

  async function expand(idea: Idea, viaModel: boolean): Promise<void> {
    setStatus("expanding");
    setError(null);
    setNote(null);
    try {
      // The whole card goes over, provenance included; the route re-parses it
      // against the draft schema, which strips anything it did not ask for.
      const response = await fetch("/api/ideas/expand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, curatedOnly: !viaModel }),
      });
      const payload = (await response.json()) as DrawResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `request failed (${response.status})`);
      setDeck(payload.ideas);
      setNote(describe(payload));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStatus("idle");
    }
  }

  async function dismiss(idea: Idea): Promise<void> {
    const response = await fetch("/api/dismissed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: idea.title }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "could not record that");
      return;
    }
    setStats((current) => ({ ...current, dismissed: current.dismissed + 1 }));
    await draw();
  }

  const current = deck[0];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-mist-200">
            Murmur
          </h1>
          <p className="text-sm text-mist-400/80">One idea at a time. Take it or leave it.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowShelf((open) => !open)}
          className="rounded-lg border border-ink-500 px-3 py-1.5 text-sm text-mist-400 transition hover:text-mist-200"
        >
          Shelf ({saved.length})
        </button>
      </header>

      <FilterBar filter={filter} onChange={setFilter} disabled={busy} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCuratedOnly(true);
            void draw(true);
          }}
          disabled={busy}
          className="rounded-xl border border-phosphor/30 bg-phosphor/10 px-4 py-2 text-sm text-phosphor transition hover:bg-phosphor/20 disabled:opacity-40"
        >
          {busy ? "Thinking…" : current ? "Another one" : "Give me something"}
          <span className="ml-2 text-xs text-mist-400/70">instant</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCuratedOnly(false);
            void draw(false);
          }}
          disabled={busy}
          className="rounded-xl border border-ink-600 px-4 py-2 text-sm text-mist-200 transition hover:border-mist-400/60 disabled:opacity-40"
        >
          Something new
          <span className="ml-2 text-xs text-mist-400/70">the model · about a minute</span>
        </button>
        {note ? <span className="text-xs text-mist-400/70">{note}</span> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember">
          {error}
        </p>
      ) : null}

      {busy ? <Waiting status={status} elapsed={elapsed} /> : null}

      {!busy && current ? (
        <IdeaCard
          idea={current}
          saved={savedIds.has(current.id)}
          busy={busy}
          onSave={(idea) => void keep(idea)}
          onDismiss={(idea) => void dismiss(idea)}
          onExpand={(idea, viaModel) => void expand(idea, viaModel)}
        />
      ) : null}

      {!busy && !current ? (
        <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg text-mist-400">
            Nothing on the easel yet.
          </p>
          <p className="mt-2 text-sm text-mist-400/60">
            The curated shelf has {corpusSize} ideas in it. Press the button and one will arrive.
          </p>
        </div>
      ) : null}

      {showShelf ? <Shelf entries={saved} onClose={() => setShowShelf(false)} /> : null}

      <footer className="mt-auto pt-4 text-xs text-mist-400/50">
        {stats.saved} kept · {stats.dismissed} passed · {stats.seen} shown · {corpusSize} curated ·{" "}
        {stats.seen >= corpusSize ? "the curated shelf is exhausted, the model carries it now" : null}
      </footer>
    </div>
  );
}

function describe(payload: DrawResponse): string {
  const { telemetry, fallback, modelServer } = payload;
  const wake =
    modelServer?.started === true
      ? ` · woke the model in ${(modelServer.waitedMs / 1000).toFixed(0)}s`
      : "";
  if (fallback) return `${fallback.reason} — showing a curated card instead.`;
  // Keyed on `provider`, not on a null `model`: both the curated draw and the
  // curated fusion report provider "corpus" with no model, and labelling either
  // of them "model" would credit the 30B MoE for a card it never saw.
  if (telemetry.provider === "corpus") return `curated · ${elapsed(telemetry.latencyMs)}`;
  return telemetry.fallbackUsed
    ? `${telemetry.model ?? "model"} · fell back to curated`
    : `${telemetry.model ?? "model"} · ${elapsed(telemetry.latencyMs)}${wake}`;
}

/** A curated card answers in single-digit milliseconds; "0.0s" would read as broken. */
function elapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function Waiting({ status, elapsed }: { status: Status; elapsed: number }): React.ReactElement {
  const minutes = Math.floor(elapsed / 60);
  const clock = minutes > 0 ? `${minutes}m ${elapsed % 60}s` : `${elapsed}s`;
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800/40 px-6 py-14 text-center">
      <p className="font-[family-name:var(--font-display)] text-lg text-mist-200">
        {status === "expanding" ? "Taking it further…" : "Reaching for one…"}
      </p>
      <p className="mt-2 text-sm text-mist-400/70">
        {clock} — a thirty-billion-parameter model is writing this card out word by word on
        this machine, one word about every tenth of a second. The very first one also waits
        half a minute while its weights load onto the graphics card. The instant buttons do
        the same job without the wait.
      </p>
    </div>
  );
}

function Shelf({
  entries,
  onClose,
}: {
  entries: SavedIdea[];
  onClose: () => void;
}): React.ReactElement {
  return (
    <section
      aria-label="Shelf"
      className="space-y-3 rounded-2xl border border-ink-600 bg-ink-800/70 p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.18em] text-mist-400/70">Your shelf</h2>
        <button type="button" onClick={onClose} className="text-sm text-mist-400 hover:text-mist-200">
          close
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-mist-400/70">Nothing kept yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.idea.id} className="border-l-2 border-phosphor/30 pl-3">
              <p className="font-[family-name:var(--font-display)] text-base text-mist-200">
                {entry.idea.title}
              </p>
              <p className="mt-0.5 text-sm text-phosphor/80">{entry.idea.prompt}</p>
              <p className="mt-1 text-xs text-mist-400/60">
                {entry.idea.category} · {entry.idea.tags.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}