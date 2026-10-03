/**
 * The shared vocabulary of the app, kept in its own module so that the browser
 * bundle can import it without dragging the prompt text along with it.
 */

/** The six subject pillars the corpus is built around. */
export const PILLARS = [
  "architecture",
  "design",
  "engineering",
  "development",
  "intelligence",
  "mechanics",
] as const;

export type Pillar = (typeof PILLARS)[number];

/** The finish applied to any pillar. */
export const MOOD = [
  "psychedelic",
  "mystic",
  "ethereal",
  "mysterious",
  "astronomic",
  "esoteric",
] as const;