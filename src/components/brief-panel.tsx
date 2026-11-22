"use client";

import { PenLine } from "lucide-react";

import { useI18n } from "@/components/locale-provider";
import { MAX_BRIEF_LENGTH } from "@/lib/brief";

export function BriefPanel({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  busy: boolean;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <form
      className="studio-panel-soft rounded-2xl p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="murmur-brief" className="label-caps flex items-center gap-2">
        <PenLine className="h-3.5 w-3.5 text-sand" aria-hidden />
        {t("briefLabel")}
      </label>
      <textarea
        id="murmur-brief"
        value={value}
        maxLength={MAX_BRIEF_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("briefPlaceholder")}
        rows={2}
        disabled={busy}
        className="mt-3 w-full resize-y rounded-xl border border-sage/35 bg-canvas/50 px-3 py-2.5 text-sm leading-relaxed text-parchment outline-none placeholder:text-sand/45 focus:border-ochre/60"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs leading-relaxed text-sand/70">{t("briefHint")}</p>
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="button-primary disabled:opacity-40"
        >
          {t("findIdeas")}
        </button>
      </div>
    </form>
  );
}
