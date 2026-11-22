import { ArtworkAnalysisSchema, fingerprintTraits } from "@/lib/artwork";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { analyzeArt, RequestError } from "@/lib/router";
import { getStore } from "@/lib/store";

/**
 * POST /api/ideas/analyze — improve on a painting she uploads.
 *
 * The browser has already read the image on a canvas and sends only a measured
 * fingerprint plus an optional downscaled JPEG. The fingerprint is validated
 * here just like any other input. The traits are returned with the card so the
 * UI can show what was observed, whether or not a model was available.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const parsed = ArtworkAnalysisSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new RequestError(
        `bad request: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
          .join(", ")}`,
      );
    }
    const input = parsed.data;
    const store = getStore();
    const [seen, dismissed] = await Promise.all([store.listSeen(), store.listDismissed()]);
    const result = await analyzeArt(input, [...new Set([...seen, ...dismissed])]);
    await store.markSeen(result.ideas.map((idea) => idea.title));
    return json({
      ...result,
      analysis: {
        traits: fingerprintTraits(input.fingerprint),
        palette: input.fingerprint.palette,
        language: input.language,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
