import { z } from "zod";

import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { RequestError } from "@/lib/router";
import { getStore } from "@/lib/store";

const TITLE = z.string().trim().min(1).max(400);

/**
 * POST /api/dismissed — "not this one".
 *
 * Dismissal is what makes the deck feel like it is listening: dismissed titles
 * are fed back as exclusions on every later draw, so a card she said no to
 * does not come back around.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const parsed = z
      .object({ title: TITLE, dismissed: z.boolean().default(true) })
      .safeParse(body);
    if (!parsed.success) {
      throw new RequestError(
        `bad request: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`)
          .join(", ")}`,
      );
    }
    const store = getStore();
    if (parsed.data.dismissed) {
      await store.dismiss(parsed.data.title);
    } else {
      await store.undismiss(parsed.data.title);
    }
    return json({ dismissed: await store.listDismissed() });
  } catch (error) {
    return errorResponse(error);
  }
}