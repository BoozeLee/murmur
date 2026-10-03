# Murmur

One painting idea at a time. Take it or leave it.

Built for one painter who gets stuck in front of the easel. She opens it, presses
one button, and gets a single idea: what to paint, the artistic problem inside
it, where the light comes from, a palette, and a line she can read from the
easel. Keep the ones worth keeping, refuse the rest, and the deck stops
offering them.

One idea at a time: she opens it when she is stuck. The deck is the whole
product — there is no delivery channel, no account, and no notification. A push
was built and then cut, because nothing about a daily nudge was asked for.

## Where the ideas come from

| Path | What it is | Speed |
|---|---|---|
| Curated | 53 hand-written seeds, organised around six subjects — architecture, design, engineering, development, intelligence, mechanics — wearing her finish: psychedelic, mystic, ethereal, mysterious, astronomic, esoteric | instant (~100ms) |
| Model | `qwen3:8b` on this machine, writing a fresh card through a JSON Schema it cannot escape | ~11-20s |
| Fused | a kept card crossed with a curated one, when the model is unavailable | instant |

The model never gets the last word. Its answer is parsed against the same schema
the UI is built from, checked for three failure modes JSON Schema cannot express,
and repaired once if it fails. If it still fails, the curated corpus answers and
the card says so.

## Running it

```bash
bun install
bun run dev            # http://localhost:3000
```

Production:

```bash
bun run build
bun run start -p 3111
```

Checks:

```bash
bun run typecheck
bun run test           # 68 vitest tests
```

## How it is put together

The shape follows an architecture report the user chose, applied to a real
requirement and then deliberately cut down. What survived:

- **A closed vocabulary.** Six categories, 65 tags, no free text in either. A
  painter handed "mystical" instead of "esoteric" gets two different paintings,
  and an 8B model will invent synonyms for her taste every run.
- **One contract.** `src/lib/schema.ts` is the only definition of an idea. The
  Ollama JSON Schema is derived from it with `z.toJSONSchema`, so the model is
  constrained by exactly what the app validates.
- **Model output is untrusted.** Nothing from the model reaches the UI without
  passing `IdeaDraftSchema` and `qualityIssues()`. A rejection is a return
  value, never swallowed.
- **Routing policy in code.** `src/lib/router.ts` holds a table keyed by task
  class. Every row is local-only with `maxCostEur: 0`; a painting idea is not
  worth sending off the machine. Nothing in the prompt text talks about privacy.
- **Per-generation telemetry.** provider, model, latency, tokens, fallback used,
  fallback reason, prompt version, tool policy version — on the card and in the
  API response, so a bad card can be traced to the text that produced it.
- **A deterministic core.** `src/lib/engine.ts` has no clock, no network and no
  `Math.random`; draws are seeded and reproducible, which is what makes the
  curated path instant and the tests meaningful.

What was cut, and why: Postgres + pgvector (one user, no tenants, 53 rows —
there is nothing to retrieve from and nobody to authorise against), LangGraph
(three task classes and no durable state), Temporal or a queue (no background
jobs beyond one daily card), MCP (no capability is reused across clients),
Langfuse (nothing to correlate), Supabase, and a second FastAPI service (the
route handlers *are* the API; a separate process would buy nothing for one
client).

## Layout

```
src/lib/schema.ts        the contract: categories, tags, IdeaDraft, Idea, request
src/lib/corpus/seeds.ts  53 curated ideas
src/lib/engine.ts        seeded draw, filter, fuse — pure, no I/O
src/lib/quality.ts       deterministic rules a schema cannot state
src/lib/prompts.ts       versioned prompt text
src/lib/providers/       types.ts · corpus.ts · ollama.ts
src/lib/router.ts        routing policy + fallback, in code
src/lib/store.ts         file-backed saves / dismissals / seen
src/app/api/             ideas · ideas/expand · saved · dismissed
src/components/          deck · idea-card · filter-bar
```

State lives in `.data/` (gitignored): `saved.json`, `dismissed.json` and
`seen.json`. Writes are temp-file-then-rename, so an interrupted write cannot
truncate a shelf.

## Security posture

- The write routes are same-origin only. A page on any other site can otherwise
  POST to this one with the browser's ambient cookies.
- Every card is re-validated on the way in, so the shelf can only ever hold
  cards that satisfy the contract.
- Ollama is called from server code only. Nothing privileged is in the browser
  bundle.
