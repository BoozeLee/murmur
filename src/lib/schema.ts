import { z } from "zod";

export const CATEGORIES = [
  "landscape",
  "portrait",
  "abstract",
  "figurative",
  "illustration",
  "still-life",
] as const;

export const CATEGORY_LABELS: Record<Category, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  abstract: "Abstract",
  figurative: "Figurative",
  illustration: "Illustration",
  "still-life": "Still life",
};

/**
 * The tag vocabulary is closed on purpose. A painter who is handed "mystical"
 * instead of "esoteric" gets two different paintings, and an 8B model will
 * otherwise invent synonyms for her taste every time it runs.
 */
export const TAGS = [
  // her stated aesthetic
  "psychedelic",
  "mystic",
  "ethereal",
  "mysterious",
  "astronomic",
  "esoteric",
  // the supporting register
  "sacred-geometry",
  "occult",
  "ritual",
  "nocturnal",
  "bioluminescent",
  "fractal",
  "chiaroscuro",
  "monochrome",
  "gestural",
  "liminal",
  "cosmic",
  "alchemical",
  "botanical",
  "geometric",
  "atmospheric",
  "dystopian",
  "memory",
  "dream",
  "decay",
  "radiant",
  "shadow",
  "chrome",
  "vaporwave",
  "mythic",
  "submerged",
  "weather",
  "ruin",
  "flora",
  "fauna",
  "celestial",
  "underwater",
  "symmetry",
  "negative-space",
  // architecture / engineering / mechanics / machine intelligence
  "architectural",
  "mechanical",
  "clockwork",
  "engineered",
  "machine",
  "cathedral",
  "industrial",
  "blueprint",
  "design",
  "graphic",
  "time",
  "growth",
  // pillar words, kept as first-class tags so the model's language names the
  // six subjects the corpus is built around
  "architecture",
  "engineering",
  "mechanics",
  "development",
  "intelligence",
  "cognitive",
  "mystery",
  "mystical",
  "chromatic",
  "night",
  "ghost",
  // these duplicate the category axis but appear naturally in idea language
  "landscape",
  "portrait",
  "abstract",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Tag = (typeof TAGS)[number];

const shortLine = z.string().trim().min(1).max(400);
const phrase = z.string().trim().min(1).max(120);

/**
 * What the model is asked to fill in. Every field is a plain string or string
 * array — no nesting, no numbers, no markdown — because structured output
 * reliability on an 8B model collapses the moment the schema nests.
 */
export const IdeaDraftSchema = z.object({
  title: phrase,
  category: z.enum(CATEGORIES),
  tags: z.array(z.enum(TAGS)).min(2).max(5),
  /** WHAT to paint. Concrete nouns and a situation, not a mood board. */
  concept: shortLine,
  /**
   * The single most valuable field: the artistic problem that makes this idea
   * non-obvious. A painter who has hit a wall can usually solve a concept; the
   * tension is what she actually needs handed to her.
   */
  tension: shortLine,
  /** Where the light comes from and what it is doing. */
  light: shortLine,
  palette: z.array(z.string().trim().min(1).max(40)).min(3).max(6),
  composition: shortLine,
  medium: shortLine,
  /** The studio-ready one-liner, readable from the easel. */
  prompt: shortLine,
  /** Implied physical size of the subject — a small "a moth's wing" or huge "the whole sky". */
  scale: z.string().trim().min(1).max(120).optional(),
  /** What to actually go outside and look at, or set up on the table. */
  referenceAngle: z.string().trim().min(1).max(300).optional(),
  /** Where this specific idea goes wrong. */
  pitfalls: z.array(z.string().trim().min(1).max(200)).max(3).optional(),
});

export type IdeaDraft = z.infer<typeof IdeaDraftSchema>;

/**
 * A validated, provenance-stamped idea. `IdeaDraftSchema` is what the model
 * produces; this is what the rest of the app is allowed to touch. The split is
 * deliberate: model output can never introduce a field that we did not ask
 * for, because the fields are added here in code.
 */
export const IdeaSchema = IdeaDraftSchema.extend({
  id: z.string(),
  source: z.enum(["corpus", "ollama"]),
  createdAt: z.string(),
  // telemetry — the report's per-generation record
  provider: z.string().optional(),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  promptVersion: z.string().optional(),
  toolPolicyVersion: z.string().optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  fallbackUsed: z.boolean().optional(),
});

export type Idea = z.infer<typeof IdeaSchema>;

/**
 * JSON Schema for Ollama's `format` field, derived from the same zod schema so
 * the model is constrained by exactly the contract we validate against.
 * `$schema` is stripped: Ollama's grammar compiler does not want it.
 */
export function ideaJsonSchema(): Record<string, unknown> {
  const derived = z.toJSONSchema(IdeaDraftSchema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  delete derived["$schema"];
  return derived;
}

/** Generation request. Defaults are the "just give me something" case. */
export const GenerateRequestSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  tags: z.array(z.enum(TAGS)).max(4).optional(),
  /** Hard ceiling on ideas returned. The provider may return fewer. */
  count: z.number().int().min(1).max(4).default(1),
  temperature: z.number().min(0.1).max(1.4).default(0.95),
  /** Seeds the model with these titles so it can riff rather than restart. */
  seedFrom: z.array(phrase).max(3).optional(),
  /** Draw one of these exactly. Forces the deterministic path. */
  curatedOnly: z.boolean().default(false),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;