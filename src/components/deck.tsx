"use client";

import {
  BookOpen,
  Globe2,
  Hourglass,
  ImagePlus,
  PenLine,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ArtworkPanel, type ArtworkResult } from "@/components/artwork-panel";
import { BrandMark } from "@/components/brand-mark";
import { BriefPanel } from "@/components/brief-panel";
import { type DeckFilter, FilterBar } from "@/components/filter-bar";
import { IdeaCard } from "@/components/idea-card";
import { useI18n } from "@/components/locale-provider";
import { MurmurTag } from "@/components/murmur-tag";
import type { ArtworkFingerprint } from "@/lib/artwork";
import { LOCALE_LABELS } from "@/lib/i18n";
import type { Idea } from "@/lib/schema";
import type { SavedIdea, StoreStats } from "@/lib/store";

type Status = "idle" | "drawing" | "expanding" | "analyzing";
type Mode = "deck" | "brief" | "image";

interface DrawResponse {
  ideas: Idea[];
  fallback: { from: string; reason: string } | null;
  telemetry: { provider: string; model: string | null; latencyMs: number; fallbackUsed: boolean };
  modelServer?: { started: boolean; waitedMs: number } | null;
}

interface AnalyzeResponse extends DrawResponse {
  analysis: ArtworkResult;
}

const EMPTY_FILTER: DeckFilter = { tags: [] };

/** The backdrop acknowledges an intentional draw without becoming a loading spinner. */
function wakeArtwork(): void {
  window.dispatchEvent(new Event("murmur:awaken"));
}

const LEGEND = [
  ["#232419", "canvas"],
  ["#5E512C", "olive"],
  ["#5F654D", "sage"],
  ["#47391E", "umber"],
  ["#8F6F2C", "ochre"],
  ["#2D5A50", "teal"],
  ["#314534", "forest"],
  ["#A18D5A", "sand"],
] as const;

export function Deck({
  initialSaved,
  initialStats,
  corpusSize,
}: {
  initialSaved: SavedIdea[];
  initialStats: StoreStats;
  corpusSize: number;
}): React.ReactElement {
  const { t, locale, toggleLocale } = useI18n();
  const [deck, setDeck] = useState<Idea[]>([]);
  const [saved, setSaved] = useState<SavedIdea[]>(initialSaved);
  const [stats, setStats] = useState<StoreStats>(initialStats);
  const [filter, setFilter] = useState<DeckFilter>(EMPTY_FILTER);
  const [curatedOnly, setCuratedOnly] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showShelf, setShowShelf] = useState(false);
  const [mode, setMode] = useState<Mode>("deck");
  const [brief, setBrief] = useState("");
  const [analysis, setAnalysis] = useState<ArtworkResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialSaved.map((entry) => entry.idea.id)),
  );

  const reduceMotion = useReducedMotion();
  const softEnter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const },
      };
  const cardEnter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22, filter: "blur(7px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -14, filter: "blur(5px)" },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      };

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

  const describeDraw = useCallback(
    (payload: DrawResponse): string => {
      const { telemetry, fallback, modelServer } = payload;
      const wake =
        modelServer?.started === true
          ? ` · ${t("modeDeck")} ${(modelServer.waitedMs / 1000).toFixed(0)}s`
          : "";
      if (fallback) return `${fallback.reason} — ${t("fellBack")}.`;
      if (telemetry.provider === "corpus")
        return `${t("curatedNote")} · ${duration(telemetry.latencyMs)}`;
      return telemetry.fallbackUsed
        ? `${telemetry.model ?? "model"} · ${t("fellBack")}`
        : `${telemetry.model ?? "model"} · ${duration(telemetry.latencyMs)}${wake}`;
    },
    [t],
  );

  const draw = useCallback(
    async (from?: boolean, withBrief?: string) => {
      const curated = from ?? curatedOnly;
      const words = withBrief ?? brief;
      wakeArtwork();
      setStatus("drawing");
      setError(null);
      setNote(null);
      setAnalysis(null);
      try {
        const response = await fetch("/api/ideas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            category: filter.category,
            tags: filter.tags.length > 0 ? filter.tags : undefined,
            curatedOnly: curated,
            language: locale,
            ...(words.trim().length > 0 ? { brief: words.trim() } : {}),
          }),
        });
        const payload = (await response.json()) as DrawResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `request failed (${response.status})`);
        setDeck(payload.ideas);
        setNote(describeDraw(payload));
        setStats((current) => ({ ...current, seen: current.seen + payload.ideas.length }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setStatus("idle");
      }
    },
    [brief, curatedOnly, describeDraw, filter, locale],
  );

  async function analyzeArtworkRequest(
    fingerprint: ArtworkFingerprint,
    image: string,
    words: string,
  ): Promise<void> {
    wakeArtwork();
    setStatus("analyzing");
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/ideas/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fingerprint,
          image,
          note: words.trim().length > 0 ? words.trim() : undefined,
          language: locale,
        }),
      });
      const payload = (await response.json()) as AnalyzeResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `request failed (${response.status})`);
      setDeck(payload.ideas);
      setAnalysis(payload.analysis);
      setNote(describeDraw(payload));
      setStats((current) => ({ ...current, seen: current.seen + payload.ideas.length }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setStatus("idle");
    }
  }

  async function keep(idea: Idea): Promise<void> {
    const already = savedIds.has(idea.id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (already) next.delete(idea.id);
      else next.add(idea.id);
      return next;
    });

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
    setNote(already ? t("passed") : `${t("kept")} · ${t("shelf")}`);
  }

  async function expand(idea: Idea, viaModel: boolean): Promise<void> {
    wakeArtwork();
    setStatus("expanding");
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/ideas/expand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, curatedOnly: !viaModel }),
      });
      const payload = (await response.json()) as DrawResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `request failed (${response.status})`);
      setDeck(payload.ideas);
      setNote(describeDraw(payload));
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
  const modes: { id: Mode; label: string; icon: typeof Sparkles }[] = [
    { id: "deck", label: t("modeDeck"), icon: Sparkles },
    { id: "brief", label: t("modeBrief"), icon: PenLine },
    { id: "image", label: t("modeImage"), icon: ImagePlus },
  ];

  return (
    <div className="murmur-stage relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-sage/25 pb-6">
        <div className="flex items-start gap-4">
          <BrandMark className="mt-0.5 h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
          <div>
            <p className="label-caps">
              {t("studioDeck")} · {String(corpusSize).padStart(3, "0")} {t("studies")}
            </p>
            <h1 className="sr-only">Murmur</h1>
            <MurmurTag className="mt-1 h-14 w-52 sm:h-16 sm:w-64" />
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-sand/85">{t("tagline")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            className="button-quiet"
            aria-label={`Language: ${LOCALE_LABELS[locale]}`}
          >
            <Globe2 className="h-4 w-4 text-sand" aria-hidden />
            {LOCALE_LABELS[locale]}
          </button>
          <button
            type="button"
            onClick={() => setShowShelf((open) => !open)}
            aria-expanded={showShelf}
            className="button-quiet"
          >
            <BookOpen className="h-4 w-4 text-sand" aria-hidden />
            {t("shelf")}
            <span className="rounded-full border border-sage/40 px-1.5 text-xs text-parchment">
              {saved.length}
            </span>
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <section aria-label={t("drawControls")} className="studio-panel rounded-2xl p-4 sm:p-5">
            <div
              className="mb-4 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label={t("drawControls")}
            >
              {modes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  className={
                    mode === id
                      ? "inline-flex items-center gap-1.5 rounded-full border border-ochre/60 bg-ochre/15 px-3 py-1 text-sm text-parchment"
                      : "inline-flex items-center gap-1.5 rounded-full border border-sage/35 px-3 py-1 text-sm text-sand/80 transition hover:border-sand/50"
                  }
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <FilterBar filter={filter} onChange={setFilter} disabled={busy} />

            {mode === "brief" ? (
              <div className="mt-5">
                <BriefPanel
                  value={brief}
                  onChange={setBrief}
                  busy={busy}
                  onSubmit={() => void draw(false, brief)}
                />
              </div>
            ) : null}

            {mode === "image" ? (
              <div className="mt-5">
                <ArtworkPanel
                  onAnalyze={(fingerprint, image, words) =>
                    void analyzeArtworkRequest(fingerprint, image, words)
                  }
                  busy={busy}
                  result={analysis}
                />
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCuratedOnly(true);
                  void draw(true);
                }}
                disabled={busy}
                className="button-primary disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {busy ? t("thinking") : current ? t("anotherOne") : t("giveMeSomething")}
                <span className="text-xs text-parchment/70">{t("instant")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCuratedOnly(false);
                  void draw(false);
                }}
                disabled={busy}
                className="button-quiet disabled:opacity-40"
              >
                <WandSparkles className="h-4 w-4 text-glow" aria-hidden />
                {t("somethingNew")}
                <span className="text-xs text-sand/60">{t("aboutAMinute")}</span>
              </button>
              <p aria-live="polite" className="min-h-4 text-xs text-sand/70">
                {note}
              </p>
            </div>
          </section>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember"
            >
              {error}
            </p>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.div key="waiting" {...softEnter}>
                <Waiting status={status} elapsed={elapsed} />
              </motion.div>
            ) : current ? (
              <motion.div key={current.id} {...cardEnter}>
                <IdeaCard
                  idea={current}
                  saved={savedIds.has(current.id)}
                  busy={busy}
                  onSave={(idea) => void keep(idea)}
                  onDismiss={(idea) => void dismiss(idea)}
                  onExpand={(idea, viaModel) => void expand(idea, viaModel)}
                />
              </motion.div>
            ) : (
              <motion.div key="empty" {...softEnter}>
                <div className="studio-panel-soft rounded-[1.75rem] border-dashed px-6 py-16 text-center">
                  <p className="type-display text-xl text-parchment">{t("nothingOnEasel")}</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-sand/70">
                    {t("emptyHelp", { count: corpusSize })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showShelf ? (
              <motion.div key="shelf" {...softEnter}>
                <Shelf entries={saved} onClose={() => setShowShelf(false)} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <StudioNote stats={stats} corpusSize={corpusSize} />
          <PaletteLegend />
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-sage/20 pt-4 text-xs text-sand/50">
        <span>{t("footerLocal")}</span>
        <span>{t("footerPress")}</span>
      </footer>
    </div>
  );
}

/** A curated card answers in single-digit milliseconds; "0.0s" would read as broken. */
function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function StudioNote({
  stats,
  corpusSize,
}: {
  stats: StoreStats;
  corpusSize: number;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <section className="studio-panel-soft rounded-2xl p-5">
      <p className="label-caps">{t("onTheShelf")}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label={t("kept")} value={stats.saved} />
        <Stat label={t("passed")} value={stats.dismissed} />
        <Stat label={t("shown")} value={stats.seen} />
        <Stat label={t("curated")} value={corpusSize} />
      </dl>
      <div className="rule-brush mt-5 opacity-60" />
      <p className="mt-4 text-xs leading-relaxed text-sand/70">
        {stats.seen >= corpusSize ? t("shelfExhausted") : t("shelfNote")}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-xl border border-sage/25 bg-canvas/40 px-3 py-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.16em] text-sand/65">{label}</dt>
      <dd className="type-display mt-0.5 text-xl text-parchment">{value}</dd>
    </div>
  );
}

function PaletteLegend(): React.ReactElement {
  const { t } = useI18n();
  return (
    <section className="studio-panel-soft rounded-2xl p-5">
      <p className="label-caps">{t("groundColours")}</p>
      <ul className="mt-4 grid grid-cols-4 gap-3">
        {LEGEND.map(([hex, name]) => (
          <li key={hex} className="text-center">
            <span
              aria-hidden
              className="mx-auto block h-8 w-8 rounded-full ring-1 ring-parchment/10"
              style={{ backgroundColor: hex }}
            />
            <span className="mt-1 block text-[0.58rem] tracking-wide text-sand/65">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Waiting({ status, elapsed }: { status: Status; elapsed: number }): React.ReactElement {
  const { t } = useI18n();
  const minutes = Math.floor(elapsed / 60);
  const clock = minutes > 0 ? `${minutes}m ${elapsed % 60}s` : `${elapsed}s`;
  const label =
    status === "expanding"
      ? t("waitingExpand")
      : status === "analyzing"
        ? t("waitingAnalysis")
        : t("waitingDraw");
  return (
    <div role="status" className="studio-panel rounded-[1.75rem] px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ochre/40 bg-ochre/10 text-ochre">
        <Hourglass className="h-5 w-5 animate-pulse" aria-hidden />
      </div>
      <p className="type-display mt-4 text-xl text-parchment">{label}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-sand/75">
        {clock} — {t("waitingBody")}
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
  const { t, categoryLabel, tagLabel } = useI18n();
  return (
    <section aria-label={t("shelf")} className="studio-panel rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="label-caps">{t("yourShelf")}</p>
          <h2 className="type-display mt-1 text-xl text-parchment">{t("keptStudies")}</h2>
        </div>
        <button type="button" onClick={onClose} className="button-ghost">
          <X className="h-4 w-4" aria-hidden />
          {t("close")}
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="mt-5 text-sm text-sand/70">{t("nothingKept")}</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.idea.id} className="rounded-xl border border-sage/25 bg-canvas/40 p-4">
              <p className="type-display text-base text-parchment">{entry.idea.title}</p>
              <p className="mt-1 text-sm leading-snug text-glow/85">{entry.idea.prompt}</p>
              <p className="mt-2 text-xs text-sand/60">
                {categoryLabel(entry.idea.category)} · {entry.idea.tags.map(tagLabel).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
