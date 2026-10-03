import { allIdeas } from "@/lib/corpus/deepened";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { run } from "@/lib/router";
import { getStore } from "@/lib/store";

/**
 * POST /api/ideas — draw cards.
 *
 * The handler holds no policy of its own: the request is validated by
 * GenerateRequestSchema and the provider decision belongs to the policy table in
 * the router. The one thing it does own is *history* — titles already on screen
 * are excluded server-side, because a client that lies about what it has
 * already shown would otherwise be able to force a repeat.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const store = getStore();
    const [seen, dismissed] = await Promise.all([store.listSeen(), store.listDismissed()]);
    const exclude = [...new Set([...seen, ...dismissed])];

    const result = await run("deck.draw", body, [], exclude);
    await store.markSeen(result.ideas.map((idea) => idea.title));
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/ideas — what the machine has, for the footer counters. */
export async function GET(): Promise<Response> {
  try {
    const stats = await getStore().stats();
    return json({ stats, corpusSize: allIdeas().length });
  } catch (error) {
    return errorResponse(error);
  }
}