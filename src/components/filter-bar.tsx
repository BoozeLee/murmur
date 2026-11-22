"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/components/locale-provider";
import { CATEGORIES, type Category, TAGS, type Tag } from "@/lib/schema";
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
  const visibleTags = showAllTags ? TAGS : FAVOURITES;
  const { t, categoryLabel, tagLabel } = useI18n();

  function toggleTag(tag: Tag): void {
    if (filter.tags.includes(tag)) {
      onChange({ ...filter, tags: filter.tags.filter((other) => other !== tag) });
      return;
    }
    if (filter.tags.length >= MAX_TAGS) return;
    onChange({ ...filter, tags: [...filter.tags, tag] });
  }

  return (
    <section aria-label="Filters" className="studio-panel-soft rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-sand" aria-hidden />
        <span className="label-caps">{t("tuneTheDeck")}</span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-caps mr-1">{t("kind")}</span>
          <FilterChip
            active={filter.category === undefined}
            disabled={disabled}
            onClick={() => onChange({ ...filter, category: undefined })}
          >
            {t("anything")}
          </FilterChip>
          {CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              active={filter.category === category}
              disabled={disabled}
              onClick={() => onChange({ ...filter, category })}
            >
              {categoryLabel(category)}
            </FilterChip>
          ))}
        </div>

        <div className="rule-brush opacity-60" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-caps mr-1">
            {t("moodSubject")}
            {filter.tags.length > 0 ? (
              <span className="ml-1 normal-case tracking-normal text-sand/60">
                {filter.tags.length}/{MAX_TAGS}
              </span>
            ) : null}
          </span>
          {visibleTags.map((tag) => (
            <FilterChip
              key={tag}
              active={filter.tags.includes(tag)}
              disabled={disabled}
              onClick={() => toggleTag(tag)}
            >
              {tagLabel(tag)}
            </FilterChip>
          ))}
          <button
            type="button"
            onClick={() => setShowAllTags((open) => !open)}
            className="rounded-full border border-dashed border-sage/40 px-2 py-0.5 text-[0.7rem] text-sand/80 transition hover:border-sand/50 hover:text-parchment"
          >
            {showAllTags ? t("fewer") : t("more")}
          </button>
        </div>
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
          ? "rounded-full border border-ochre/60 bg-ochre/15 px-2.5 py-0.5 text-[0.72rem] text-parchment shadow-[inset_0_0_0_1px_rgba(161,141,90,0.08)] transition"
          : "rounded-full border border-sage/35 bg-canvas/40 px-2.5 py-0.5 text-[0.72rem] text-sand/80 transition hover:border-sand/50 hover:text-parchment disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}
