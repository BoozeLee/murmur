import type { Idea } from "@/lib/schema";
import { CATEGORY_LABELS } from "@/lib/schema";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr]">
      <dt className="pt-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-mist-400/70">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-mist-200/90">{children}</dd>
    </div>
  );
}

function Chips({ items, tone = "quiet" }: { items: readonly string[]; tone?: "quiet" | "accent" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={
            tone === "accent"
              ? "rounded-full border border-phosphor/25 bg-phosphor/10 px-2 py-0.5 text-[0.7rem] text-phosphor"
              : "rounded-full border border-ink-500 bg-ink-800 px-2 py-0.5 text-[0.7rem] text-mist-400"
          }
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * One painting idea. The field order is the order a painter actually needs them:
 * what, then the problem that makes it worth doing, then the decisions, then the
 * one-liner to read from the easel.
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
  return (
    <article className="rounded-2xl border border-ink-600 bg-ink-800/80 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-sm">
      <header className="border-b border-ink-700 px-5 py-4 sm:px-7">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-mist-400/70">
          {CATEGORY_LABELS[idea.category]}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight text-mist-200 sm:text-3xl">
          {idea.title}
        </h2>
        <div className="mt-3">
          <Chips items={idea.tags} />
        </div>
      </header>

      <dl className="space-y-3 px-5 py-5 sm:px-7">
        <Row label="The idea">{idea.concept}</Row>
        <Row label="The problem">
          <span className="text-mist-200">{idea.tension}</span>
        </Row>
        <Row label="Light">{idea.light}</Row>
        <Row label="Palette">
          <Chips items={idea.palette} tone="accent" />
        </Row>
        <Row label="Composition">{idea.composition}</Row>
        <Row label="Medium">
          {idea.medium}
          {idea.scale ? <span className="text-mist-400"> — {idea.scale}</span> : null}
        </Row>
        {idea.referenceAngle ? <Row label="Go look at">{idea.referenceAngle}</Row> : null}
        {idea.pitfalls && idea.pitfalls.length > 0 ? (
          <Row label="Where it fails">
            <ul className="list-disc space-y-1 pl-4">
              {idea.pitfalls.map((pitfall) => (
                <li key={pitfall}>{pitfall}</li>
              ))}
            </ul>
          </Row>
        ) : null}
      </dl>

      <div className="border-t border-ink-700 px-5 py-4 sm:px-7">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-mist-400/70">At the easel</p>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-lg leading-snug text-phosphor/95">
          {idea.prompt}
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-ink-700 px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={() => onSave(idea)}
          disabled={busy}
          className="rounded-lg border border-phosphor/30 bg-phosphor/10 px-3 py-1.5 text-sm text-phosphor transition hover:bg-phosphor/20 disabled:opacity-40"
        >
          {saved ? "Kept" : "Keep this"}
        </button>
        <button
          type="button"
          onClick={() => onExpand(idea, false)}
          disabled={busy}
          className="rounded-lg border border-phosphor/30 bg-phosphor/10 px-3 py-1.5 text-sm text-phosphor transition hover:bg-phosphor/20 disabled:opacity-40"
        >
          Take it further
          <span className="ml-1.5 text-xs text-mist-400/70">instant</span>
        </button>
        <button
          type="button"
          onClick={() => onExpand(idea, true)}
          disabled={busy}
          className="rounded-lg border border-ink-500 px-3 py-1.5 text-sm text-mist-200 transition hover:border-ink-500 hover:bg-ink-700 disabled:opacity-40"
        >
          Further, by the model
          <span className="ml-1.5 text-xs text-mist-400/70">about a minute</span>
        </button>
        <button
          type="button"
          onClick={() => onDismiss(idea)}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-sm text-mist-400 transition hover:text-ember disabled:opacity-40"
        >
          Not this one
        </button>
        <span className="ml-auto text-[0.7rem] text-mist-400/60">
          {/* Keyed on `provider`, not `source`: `source` says which pool a card
              belongs to, and llama.cpp cards live in the corpus pool, so a
              `source` check would label a card the MoE just wrote as "curated". */}
          {idea.provider ? (idea.model ?? idea.provider) : "curated"}
          {idea.latencyMs ? ` · ${(idea.latencyMs / 1000).toFixed(1)}s` : ""}
          {idea.fallbackUsed ? " · fell back" : ""}
        </span>
      </footer>
    </article>
  );
}