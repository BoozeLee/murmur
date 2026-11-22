import { z } from "zod";

/**
 * A small, honest description of a painting.
 *
 * The browser reads the uploaded image on a canvas and sends only these numbers
 * plus a downscaled JPEG. Nothing is inferred that was not measured, and the
 * same traits are shown to the painter before any model is involved — so the
 * feature still works with no API key at all.
 */

export const ArtworkFingerprintSchema = z.object({
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  palette: z
    .array(z.string().regex(/^#[0-9a-f]{6}$/i))
    .min(1)
    .max(8),
  meanLuminance: z.number().min(0).max(1),
  contrast: z.number().min(0).max(1),
  saturation: z.number().min(0).max(1),
  /** -1 cool (blue), +1 warm (red). */
  warmth: z.number().min(-1).max(1),
  /** Fraction of pixels with a strong local gradient. */
  edgeDensity: z.number().min(0).max(1),
  /** Luminance share of the left half and the top half. */
  balance: z.object({
    left: z.number().min(0).max(1),
    top: z.number().min(0).max(1),
  }),
});

export type ArtworkFingerprint = z.infer<typeof ArtworkFingerprintSchema>;

export const ARTWORK_TRAITS = [
  "dark",
  "light",
  "highContrast",
  "lowContrast",
  "warm",
  "cool",
  "busy",
  "quiet",
  "leftHeavy",
  "rightHeavy",
  "topHeavy",
  "bottomHeavy",
] as const;

export type ArtworkTrait = (typeof ARTWORK_TRAITS)[number];

/** Roughly 1.4 MB of JPEG — enough for a 768px image, small enough to be polite. */
export const IMAGE_DATA_MAX_LENGTH = 2_000_000;
export const IMAGE_DATA_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export const ArtworkAnalysisSchema = z.object({
  fingerprint: ArtworkFingerprintSchema,
  /** Downscaled data URL. Optional: analysis works without it, improvement does not. */
  image: z.string().max(IMAGE_DATA_MAX_LENGTH).regex(IMAGE_DATA_PATTERN).optional(),
  note: z.string().trim().max(500).optional(),
  language: z.enum(["en", "nl"]).default("en"),
  curatedOnly: z.boolean().default(false),
});

export type ArtworkAnalysisRequest = z.infer<typeof ArtworkAnalysisSchema>;

export function fingerprintTraits(fp: ArtworkFingerprint): ArtworkTrait[] {
  const traits: ArtworkTrait[] = [];
  if (fp.meanLuminance < 0.3) traits.push("dark");
  else if (fp.meanLuminance > 0.62) traits.push("light");
  if (fp.contrast > 0.2) traits.push("highContrast");
  else if (fp.contrast < 0.1) traits.push("lowContrast");
  if (fp.warmth > 0.12) traits.push("warm");
  else if (fp.warmth < -0.12) traits.push("cool");
  if (fp.edgeDensity > 0.12) traits.push("busy");
  else if (fp.edgeDensity < 0.04) traits.push("quiet");
  if (fp.balance.left > 0.58) traits.push("leftHeavy");
  else if (fp.balance.left < 0.42) traits.push("rightHeavy");
  if (fp.balance.top > 0.58) traits.push("topHeavy");
  else if (fp.balance.top < 0.42) traits.push("bottomHeavy");
  return traits;
}

const TRAIT_PROSE: Record<ArtworkTrait, string> = {
  dark: "a dark ground",
  light: "a light ground",
  highContrast: "high contrast",
  lowContrast: "low contrast",
  warm: "a warm palette",
  cool: "a cool palette",
  busy: "a busy surface with many edges",
  quiet: "a quiet, almost empty surface",
  leftHeavy: "most of the visual weight on the left",
  rightHeavy: "most of the visual weight on the right",
  topHeavy: "most of the visual weight high in the frame",
  bottomHeavy: "most of the visual weight low in the frame",
};

/**
 * The brief handed to the idea model. It describes measurements, not taste —
 * the model is asked to supply the taste.
 */
export function fingerprintToBrief(
  fp: ArtworkFingerprint,
  note?: string,
  language: "en" | "nl" = "en",
): string {
  const traits = fingerprintTraits(fp);
  const observed =
    traits.length > 0 ? traits.map((trait) => TRAIT_PROSE[trait]).join(", ") : "no dominant trait";
  const colours = fp.palette.slice(0, 5).join(", ");
  const wish =
    note === undefined || note.trim().length === 0 ? "improve what is there" : note.trim();
  return [
    `Build on an existing painting. Measured: ${observed}; colours ${colours}.`,
    `The painter asks: ${wish}.`,
    language === "nl" ? "Schrijf de kaart in het Nederlands." : "Write the card in English.",
    "Name one concrete change that would improve it, the new light source, and the one artistic problem this change solves. Do not describe the existing painting back to her.",
  ].join("\n");
}

export function fingerprintToTags(fp: ArtworkFingerprint): readonly string[] {
  const tags: string[] = [];
  const traits = fingerprintTraits(fp);
  if (traits.includes("dark")) tags.push("nocturnal", "shadow");
  if (traits.includes("light")) tags.push("radiant");
  if (traits.includes("highContrast")) tags.push("chiaroscuro");
  if (traits.includes("lowContrast")) tags.push("atmospheric");
  if (traits.includes("warm")) tags.push("alchemical");
  if (traits.includes("cool")) tags.push("submerged");
  if (traits.includes("busy")) tags.push("gestural");
  if (traits.includes("quiet")) tags.push("negative-space");
  return tags;
}

export function noteToBrief(note: string | undefined, imageBrief: string): string {
  return note === undefined || note.trim().length === 0
    ? imageBrief
    : `${imageBrief}\nThe painter also said: ${note.trim()}`;
}
