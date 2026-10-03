"use client";

import { useState } from "react";

import { CATEGORIES, CATEGORY_LABELS, TAGS, type Category, type Tag } from "@/lib/schema";
import { MOOD, PILLARS } from "@/lib/vocabulary";

export interface DeckFilter {
  category?: Category;
  tags: Tag[];
}

const MAX_TAGS = 4;

const FAVOURITE_SET = new Set<string>([...PILLARS, ...MOOD]);
const FAVOURITES: Tag[] = TAGS.filter((tag) => FAVOURITE_SET.has(tag));

export function FilterBar({
  filter,
  onChange,
  disabled,
}: {
  filter: DeckFilter;
  onChange: (next: DeckFilter) => void;
  disabled: boolean;
}): React.ReactElement {
  const [showAllTags, setShowAllTags] = useState(false);
  const visibleTags = showAllTags
    ? TAGS
    : TAGS.filter((tag) => FAVOURITES.includes(tag));

  function toggleTag(tag: Tag): void {
    const has = filter.tags.includes(tag);
    if (has) {
      onChange({ ...filter, tags: filter.tags.filter((other) => other !== tag) });
      return;
    }
    if (filter.tags.length >= MAX_TAGS) return;
    onChange({ ...filter, tags: [...filter.tags, tag] });
  }

  return (
    <section
      aria-label="Filters"
      className="space-y-3 rounded-2xl border border-ink-700 bg-ink-800/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.65rem] uppercase tracking-[0.18em] text-mist-400/70">Kind</span>
        <FilterChip active={filter.category === undefined} disabled={disabled} onClick={() => onChange({ ...filter, category: undefined })}>
          anything
        </FilterChip>
        {CATEGORIES.map((category) => (
          <FilterChip
            key={category}
            active={filter.category === category}
            disabled={disabled}
            onClick={() => onChange({ ...filter, category })}
          >
            {CATEGORY_LABELS[category]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.65rem] uppercase tracking-[0.18em] text-mist-400/70">
          Mood &amp; subject
          <span className="ml-1 normal-case tracking-normal text-mist-400/50">
            {filter.tags.length > 0 ? `${filter.tags.length}/${MAX_TAGS}` : ""}
          </span>
        </span>
        {visibleTags.map((tag) => (
          <FilterChip
            key={tag}
            active={filter.tags.includes(tag)}
            disabled={disabled}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </FilterChip>
        ))}
        <button
          type="button"
          onClick={() => setShowAllTags((open) => !open)}
          className="rounded-full border border-dashed border-ink-500 px-2 py-0.5 text-[0.7rem] text-mist-400/80 transition hover:text-mist-200"
        >
          {showAllTags ? "fewer" : "more"}
        </button>
      </div>
    </section>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        active
          ? "rounded-full border border-phosphor/40 bg-phosphor/15 px-2.5 py-0.5 text-[0.72rem] text-phosphor transition"
          : "rounded-full border border-ink-500 px-2.5 py-0.5 text-[0.72rem] text-mist-400 transition hover:border-ink-500 hover:text-mist-200 disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}