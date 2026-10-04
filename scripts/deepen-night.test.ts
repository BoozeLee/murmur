import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEEPENED_LIMIT } from "../src/lib/corpus/deepened";
import { SEED_IDEAS } from "../src/lib/corpus/seeds";
import { IdeaDraftSchema } from "../src/lib/schema";
import type { IdeaDraft } from "../src/lib/schema";

/**
 * The nightly wrapper has to be able to say "there is nothing left to write"
 * before it asks for the model server, and it has to be able to prove it.
 *
 * Both cases below run the real script against a temporary corpus, because the
 * claim being tested is about ordering: a check that lives inside the deepening
 * loop would be true and useless. The model server is made unreachable on
 * purpose — a unit that does not exist, and a port nothing listens on — so a run
 * that gets past the check fails fast and loudly instead of quietly loading 9.4 GB
 * onto the card.
 *
 * That is also the discriminator. The two cases differ in nothing but one card,
 * and they must not produce the same answer: if the full pool also "succeeded"
 * because the model path was broken, this file would pass for the wrong reason.
 */

const script = fileURLToPath(new URL("./deepen-night.sh", import.meta.url));

/** Enough generated cards to fill the pool, seeds included, to the last card. */
const TO_FILL = DEEPENED_LIMIT - SEED_IDEAS.length;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "murmur-deepen-night-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function draft(title: string): IdeaDraft {
  return IdeaDraftSchema.parse({
    title,
    category: "abstract",
    tags: ["mechanical", "mystic"],
    concept: `A room built around ${title}, waiting for something that has not arrived.`,
    tension: "Precision against patience, with nothing yet to be precise about.",
    light: "One lamp above the doorway and a second somewhere out of sight.",
    palette: ["cold iron", "sodium orange", "verdigris"],
    composition: "One-point perspective, the subject centred and slightly too close.",
    medium: "Acrylic and cold wax on board",
    prompt:
      "Stand inside a room built around one object, lit by a single lamp above the doorway, and let the second light stay out of sight so the shadows do the describing.",
  });
}

/** Write `generated` validated cards where the deepener reads them. */
function writePool(generated: number): void {
  mkdirSync(join(dir, "corpus"), { recursive: true });
  const cards = Array.from({ length: generated }, (_, index) => ({
    ...draft(`Filler ${index}`),
    generatedAt: "2026-10-04T04:23:00.000Z",
    model: "glm-iq3_xs",
  }));
  writeFileSync(join(dir, "corpus", "deepened.json"), JSON.stringify(cards), "utf8");
}

function runNight(): { status: number | null; output: string; ms: number } {
  const startedAt = Date.now();
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...process.env,
      MURMUR_DATA_DIR: dir,
      // Nothing here can boot. The unit does not exist and the port is closed, so
      // a run that reaches the model says it could not come up and stops.
      MURMUR_MODEL_UNIT: "murmur-model-test-does-not-exist.service",
      MURMUR_LLAMACPP_PORT: "45999",
    },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    ms: Date.now() - startedAt,
  };
}

describe("deepen-night.sh", () => {
  it("leaves without starting anything when the pool is at its ceiling", () => {
    writePool(TO_FILL);

    const { status, output, ms } = runNight();

    // The preflight's own numbers, so this cannot pass by the run failing early
    // for some other reason: it read a pool of exactly the limit and called it full.
    expect(output).toContain(`"pool":${DEEPENED_LIMIT},"generated":${TO_FILL}`);
    expect(output).toContain('"full":true');
    expect(output).toContain("the pool is at its ceiling");
    // Zero, not one: a full pool is the end the corpus was given a ceiling to
    // reach, not a failed night for systemd to complain about.
    expect(status).toBe(0);
    // Loading the model is tens of seconds of weight reads. This is a file read.
    expect(ms).toBeLessThan(10_000);
  });

  it("goes on to the model when the pool is one card short of the ceiling", () => {
    writePool(TO_FILL - 1);

    const { status, output } = runNight();

    expect(output).toContain(`"pool":${DEEPENED_LIMIT - 1}`);
    expect(output).toContain('"full":false');
    expect(output).not.toContain("the pool is at its ceiling");
    // It reached the model and the model was not there — which is the proof that
    // the run above stopped early rather than simply failing early.
    expect(output).toContain("the model server would not come up");
    expect(status).toBe(1);
  });
});