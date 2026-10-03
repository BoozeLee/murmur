/**
 * Bring Murmur's model server up, or report that it is already up.
 *
 * The same helper the deck routes use, exposed as a command so a person — or the
 * overnight deepener — can ask the question directly instead of waiting for an
 * HTTP request to reveal the answer.
 *
 * Prints one JSON line. Exits 1 when the server cannot be made healthy, so a
 * shell can branch on it.
 */
import { ensureModelServer } from "../src/lib/model-server";

async function main(): Promise<void> {
  try {
    const status = await ensureModelServer();
    process.stdout.write(`${JSON.stringify(status)}\n`);
    if (!status.idleTimerArmed) {
      process.stderr.write(
        "ensure-model: the idle timer could not be rearmed; the server may stay resident\n",
      );
    }
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`,
    );
    process.exitCode = 1;
  }
}

await main();
