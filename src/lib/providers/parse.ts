import { qualityIssues } from "../quality";
import type { IdeaDraft } from "../schema";
import { IdeaDraftSchema } from "../schema";

/**
 * The one place model output becomes an IdeaDraft.
 *
 * Both local runners — Ollama and llama.cpp — hand back an untrusted string, and
 * both must apply exactly the same gate to it. A second implementation of this
 * check would be a second opinion about what a valid card is, and the two would
 * drift; so the check lives here once and both providers import it.
 *
 * The rule is all-or-nothing: if any idea in the answer breaks the contract, the
 * whole answer is rejected with the reason, and the caller feeds that reason back
 * for one informed repair. A partially-good answer is not worth keeping, because
 * the caller cannot tell which cards were the good ones.
 */

export interface ParsedAnswer {
  drafts: IdeaDraft[] | null;
  /** Empty when drafts is non-null; otherwise why the answer was refused. */
  reason: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseDrafts(content: string): ParsedAnswer {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    return { drafts: null, reason: `not valid JSON: ${errorMessage(error)}` };
  }

  const items = Array.isArray(raw) ? raw : [raw];
  const drafts: IdeaDraft[] = [];
  for (const item of items) {
    const parsed = IdeaDraftSchema.safeParse(item);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        drafts: null,
        reason:
          first === undefined
            ? "unknown schema failure"
            : `${first.path.join(".") || "(root)"}: ${first.code}`,
      };
    }
    drafts.push(parsed.data);
  }

  // Schema-valid prose can still be a title echo or a caption. Those rules have
  // no JSON Schema equivalent, so they live in quality.ts and are checked here,
  // at the same gate.
  const bad = drafts.flatMap(qualityIssues);
  if (bad.length > 0) {
    return { drafts: null, reason: bad[0] ?? "unknown quality failure" };
  }

  return { drafts, reason: "" };
}
