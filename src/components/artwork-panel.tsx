"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/locale-provider";
import type { ArtworkFingerprint, ArtworkTrait } from "@/lib/artwork";
import { readArtwork } from "@/lib/canvas-artwork";

export interface ArtworkResult {
  traits: ArtworkTrait[];
  palette: string[];
}

export function ArtworkPanel({
  onAnalyze,
  busy,
  result,
}: {
  onAnalyze: (fingerprint: ArtworkFingerprint, image: string, note: string) => void;
  busy: boolean;
  result: ArtworkResult | null;
}): React.ReactElement {
  const { t } = useI18n();
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [fingerprint, setFingerprint] = useState<ArtworkFingerprint | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    return () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function choose(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    setError(null);
    setReading(true);
    try {
      const read = await readArtwork(file);
      if (preview !== null) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setFingerprint(read.fingerprint);
      setImage(read.image);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setFingerprint(null);
      setImage(null);
    } finally {
      setReading(false);
    }
  }

  function clear(): void {
    if (preview !== null) URL.revokeObjectURL(preview);
    setPreview(null);
    setFingerprint(null);
    setImage(null);
    setNote("");
    setError(null);
  }

  const traits = result?.traits ?? [];
  const palette = result?.palette ?? fingerprint?.palette ?? [];

  return (
    <section className="studio-panel-soft rounded-2xl p-4 sm:p-5">
      <p className="label-caps flex items-center gap-2">
        <ImagePlus className="h-3.5 w-3.5 text-sand" aria-hidden />
        {t("imageLabel")}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-sand/70">{t("imageHint")}</p>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-sage/35 bg-canvas/60">
          {preview === null ? (
            <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-center text-xs text-sand/70 transition hover:text-parchment">
              <ImagePlus className="h-5 w-5" aria-hidden />
              {t("imageChoose")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy || reading}
                onChange={(event) => void choose(event.target.files?.[0])}
              />
            </label>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                aria-label={t("imageRemove")}
                className="absolute right-1 top-1 rounded-full bg-canvas/85 p-1 text-sand hover:text-parchment"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="label-caps">{t("analysisTitle")}</p>
            {palette.length > 0 ? (
              <>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label={t("paletteRead")}>
                  {palette.slice(0, 6).map((colour) => (
                    <li key={colour} className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-5 w-5 rounded-full ring-1 ring-parchment/15"
                        style={{ backgroundColor: colour }}
                      />
                      <code className="text-[0.65rem] text-sand/70">{colour}</code>
                    </li>
                  ))}
                </ul>
                {traits.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {traits.map((trait) => (
                      <li
                        key={trait}
                        className="rounded-full border border-ochre/40 bg-ochre/10 px-2 py-0.5 text-[0.7rem] text-parchment"
                      >
                        {t(trait as Parameters<typeof t>[0])}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-sand/70">{t("noAnalysisYet")}</p>
            )}
          </div>

          <div>
            <label htmlFor="murmur-image-note" className="label-caps">
              {t("imageNoteLabel")}
            </label>
            <input
              id="murmur-image-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("imageNotePlaceholder")}
              maxLength={500}
              disabled={busy}
              className="mt-1 w-full rounded-xl border border-sage/35 bg-canvas/50 px-3 py-2 text-sm text-parchment outline-none placeholder:text-sand/45 focus:border-ochre/60"
            />
          </div>

          <button
            type="button"
            disabled={busy || reading || fingerprint === null || image === null}
            onClick={() => {
              if (fingerprint !== null && image !== null) onAnalyze(fingerprint, image, note);
            }}
            className="button-primary disabled:opacity-40"
          >
            {t("improve")}
          </button>
          {error !== null ? (
            <p role="alert" className="text-xs text-ember">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
