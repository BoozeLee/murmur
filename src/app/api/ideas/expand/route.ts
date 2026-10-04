import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { ensureModelForRequest } from "@/lib/model-server";
import { expandIdea, RequestError } from "@/lib/router";
import { ExpandRequestSchema } from "@/lib/schema";
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
    const parsed = ExpandRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new RequestError(
        `bad request: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
          .join(", ")}`,
      );
    }

    // A curated expansion fuses with a corpus partner and never asks the model,
    // so this returns null rather than loading ten gigabytes off disk.
    const modelServer = await ensureModelForRequest(parsed.data);
    const result = await expandIdea(parsed.data.idea, { curatedOnly: parsed.data.curatedOnly });
    await getStore().markSeen(result.ideas.map((idea) => idea.title));
    return json({ ...result, modelServer });
  } catch (error) {
    return errorResponse(error);
  }
}