import { allIdeas, appendDeepened, generatedCount } from "../src/lib/corpus/deepened";
import { CATEGORIES } from "../src/lib/schema";
import { run } from "../src/lib/router";
import { defaultLlamacppOptions } from "../src/lib/providers/llamacpp";

/**
 * The overnight deepening run.
 *
 * Ask the 30B MoE for cards it can write better than the deck's 8B model, hold
 * every one of them to the same contract, and add the survivors to the corpus.
 * Each card is appended the moment it validates, so an interrupted night keeps
 * whatever it had already earned.
 *
 * Run it directly for a manual deepening:
 *   bun --env-file=.env.local run scripts/deepen-corpus.ts --count 6
 *
 * The systemd timer runs the wrapper script instead, because the model server has
 * to be started and stopped around this and nothing here should be doing that.
 */

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const wanted = Number(flag("count", "6"));
const count = Number.isFinite(wanted) && wanted > 0 ? Math.min(Math.floor(wanted), 40) : 6;
const temperature = Number(flag("temperature", "1.1"));
const only = flag("category", "");
const modelLabel = flag("model", defaultLlamacppOptions.model);

const startedAt = new Date().toISOString();
const added: string[] = [];
const rejected: { title?: string; reason: string }[] = [];
let consecutiveFailures = 0;

for (let index = 0; index < count; index += 1) {
  // Rotate categories so a night of cards spreads across the corpus instead of
  // piling into whatever the model happens to prefer.
  const category = only !== "" ? only : CATEGORIES[index % CATEGORIES.length];

  try {
    const result = await run(
      "corpus.deepen",
      { category, count: 1, temperature },
      [],
      allIdeas().map((idea) => idea.title),
    );

    // An Idea is an IdeaDraft plus provenance, so the drafts go in as they are.
    const append = appendDeepened(result.ideas, {
      generatedAt: startedAt,
      model: modelLabel,
    });
    added.push(...append.added.map((card) => card.idea.title));
    rejected.push(
      ...append.duplicates.map((title) => ({ title, reason: "duplicate title" })),
      ...append.overLimit.map((title) => ({ title, reason: "corpus is at its limit" })),
    );
    consecutiveFailures = 0;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    rejected.push({ reason });
    consecutiveFailures += 1;
    // Two in a row means the model server is gone or wedged; every further card
    // would cost minutes to fail the same way.
    if (consecutiveFailures >= 2) {
      rejected.push({ reason: "stopping after two consecutive failures" });
      break;
    }
  }
}

const summary = {
  model: modelLabel,
  requested: count,
  added: added.length,
  titles: added,
  rejected,
  corpusTotal: allIdeas().length,
  generatedTotal: generatedCount(),
};

console.log(JSON.stringify(summary, null, 2));

// Exit non-zero so systemd records the failure, but only when nothing was gained:
// a night that deepened the corpus by three cards is a partial success worth
// keeping quietly.
process.exit(added.length === 0 ? 1 : 0);
