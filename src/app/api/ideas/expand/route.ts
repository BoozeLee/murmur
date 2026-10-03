import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { expandIdea, RequestError } from "@/lib/router";
import { IdeaDraftSchema } from "@/lib/schema";
import { getStore } from "@/lib/store";

/**
 * POST /api/ideas/expand — take one card further.
 *
 * The incoming card is untrusted: it may have come from the model, from the
 * corpus, or from a hand-edited request. It is re-parsed against the draft
 * schema here so an expansion prompt can never be built out of arbitrary text.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const candidate = (body as { idea?: unknown } | null)?.idea;
    const parsed = IdeaDraftSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new RequestError(
        `bad request: idea is not a valid draft (${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
          .join(", ")})`,
      );
    }

    const result = await expandIdea(parsed.data);
    await getStore().markSeen(result.ideas.map((idea) => idea.title));
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}