import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { RequestError } from "@/lib/router";
import { IdeaSchema } from "@/lib/schema";
import { getStore } from "@/lib/store";

/** GET /api/saved — the kept shelf, newest first. */
export async function GET(): Promise<Response> {
  try {
    return json({ saved: await getStore().listSaved() });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/saved — keep a card, or release it.
 *
 * `{ idea }` saves. `{ id, saved: false }` releases. The idea is re-validated
 * before it touches disk, so the shelf can only ever hold cards that satisfy
 * the same contract the model had to satisfy.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = (await readJson(request)) as { idea?: unknown; id?: unknown; saved?: unknown };
    const store = getStore();

    if (body?.saved === false) {
      const id = typeof body.id === "string" ? body.id : "";
      if (id.length === 0) throw new RequestError("bad request: id is required to release a card");
      await store.unsave(id);
      return json({ saved: await store.listSaved() });
    }

    const parsed = IdeaSchema.safeParse(body?.idea);
    if (!parsed.success) {
      throw new RequestError(
        `bad request: idea is not a valid card (${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
          .join(", ")})`,
      );
    }
    await store.save(parsed.data);
    return json({ saved: await store.listSaved() });
  } catch (error) {
    return errorResponse(error);
  }
}