import { Bookmark, BookmarkCheck, Layers2, Palette, Sparkles, WandSparkles, X } from "lucide-react";

import { useI18n } from "@/components/locale-provider";
import type { Idea } from "@/lib/schema";

const PIGMENTS = [
  "#5E512C",
  "#5F654D",
  "#47391E",
  "#8F6F2C",
  "#2D5A50",
  "#314534",
  "#A18D5A",
] as const;

/** Same word always gets the same sampled pigment, without storing a mapping. */
function pigmentFor(value: string): string {
  let hash = 0;
  for (const char of value.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PIGMENTS[Math.abs(hash) % PIGMENTS.length] ?? PIGMENTS[0];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8.5rem_1fr]">
      <dt className="label-caps pt-1">{label}</dt>
      <dd className="text-sm leading-relaxed text-parchment/85">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: readonly string[] }): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-sage/35 bg-canvas/50 px-2 py-0.5 text-[0.7rem] text-sand/85"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function PigmentChips({ items }: { items: readonly string[] }): React.ReactElement {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-2 rounded-full border border-sage/30 bg-canvas/45 py-0.5 pl-0.5 pr-2.5 text-[0.72rem] text-parchment/90"
        >
          <span
            aria-hidden
            className="h-4 w-4 rounded-full ring-1 ring-parchment/15"
            style={{ backgroundColor: pigmentFor(item) }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * One painting idea, laid out in the order a painter needs it: what, the problem
 * worth solving, the decisions, then the line to read from the easel.
 */
export function IdeaCard({
  idea,
  saved,
  busy,
  onSave,
  onDismiss,
  onExpand,
}: {
  idea: Idea;
  saved: boolean;
  busy: boolean;
  onSave: (idea: Idea) => void;
  onDismiss: (idea: Idea) => void;
  /** `true` asks the model; absent fuses with a corpus partner, which is instant. */
  onExpand: (idea: Idea, viaModel: boolean) => void;
}): React.ReactElement {
  const { t, categoryLabel } = useI18n();
  return (
    <article className="studio-panel relative overflow-hidden rounded-[1.75rem]">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--color-sage),var(--color-ochre)_45%,var(--color-teal)_80%,transparent)]"
      />

      <header className="relative border-b border-sage/25 px-5 pb-5 pt-7 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-caps">{categoryLabel(idea.category)}</p>
            <h2 className="type-display mt-2 text-3xl leading-[1.08] text-parchment sm:text-4xl">
              {idea.title}
            </h2>
          </div>
          <div
            aria-hidden
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ochre/40 bg-ochre/10 text-ochre"
          >
            <Palette className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <Chips items={idea.tags} />
        </div>
      </header>

      <dl className="space-y-3.5 px-5 py-6 sm:px-8">
        <Row label={t("theIdea")}>{idea.concept}</Row>
        <Row label={t("theProblem")}>
          <span className="text-parchment">{idea.tension}</span>
        </Row>
        <Row label={t("light")}>{idea.light}</Row>
        <Row label={t("palette")}>
          <PigmentChips items={idea.palette} />
        </Row>
        <Row label={t("composition")}>{idea.composition}</Row>
        <Row label={t("medium")}>
          {idea.medium}
          {idea.scale ? <span className="text-sand/70"> — {idea.scale}</span> : null}
        </Row>
        {idea.referenceAngle ? <Row label={t("goLookAt")}>{idea.referenceAngle}</Row> : null}
        {idea.pitfalls && idea.pitfalls.length > 0 ? (
          <Row label={t("whereItFails")}>
            <ul className="list-disc space-y-1 pl-4 text-sand/80">
              {idea.pitfalls.map((pitfall) => (
                <li key={pitfall}>{pitfall}</li>
              ))}
            </ul>
          </Row>
        ) : null}
      </dl>

      <div className="relative border-t border-sage/25 bg-[linear-gradient(110deg,var(--color-teal),transparent_58%)] px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-glow" aria-hidden />
          <p className="label-caps">{t("atTheEasel")}</p>
        </div>
        <p className="type-display mt-2 text-xl leading-snug text-parchment sm:text-2xl">
          {idea.prompt}
        </p>
        <div aria-hidden className="rule-brush mt-4 max-w-xs opacity-70" />
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-sage/25 px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => onSave(idea)}
          disabled={busy}
          className="button-primary disabled:opacity-40"
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
          {saved ? t("kept") : t("keepThis")}
        </button>
        <button
          type="button"
          onClick={() => onExpand(idea, false)}
          disabled={busy}
          className="button-quiet border-ochre/40 disabled:opacity-40"
        >
          <Layers2 className="h-4 w-4 text-sand" aria-hidden />
          {t("takeFurther")}
          <span className="text-xs text-sand/60">{t("instant")}</span>
        </button>
        <button
          type="button"
          onClick={() => onExpand(idea, true)}
          disabled={busy}
          className="button-quiet disabled:opacity-40"
        >
          <WandSparkles className="h-4 w-4 text-glow" aria-hidden />
          {t("byModel")}
          <span className="text-xs text-sand/60">{t("aboutAMinute")}</span>
        </button>
        <button
          type="button"
          onClick={() => onDismiss(idea)}
          disabled={busy}
          className="button-ghost disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden />
          {t("notThisOne")}
        </button>
        <span className="ml-auto text-[0.7rem] text-sand/55">
          {/* Keyed on `provider`, not `source`: a llama.cpp card still belongs to
              the corpus pool, so `source` would mislabel a model-written card. */}
          {idea.provider ? (idea.model ?? idea.provider) : "curated"}
          {idea.latencyMs ? ` · ${(idea.latencyMs / 1000).toFixed(1)}s` : ""}
          {idea.fallbackUsed ? " · fell back" : ""}
        </span>
      </footer>
    </article>
  );
}
