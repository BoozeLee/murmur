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

## The overnight deepener

Two models, two jobs, because they are good at opposite things.

`qwen3:8b` fits in the card and answers in ten seconds, so it serves the deck.
The deck also gets cards from a second model: a **30B mixture-of-experts**,
`GLM-4.7-Flash`, distilled from Claude Opus 4.5's own high-reasoning output
(`TeichAI/GLM-4.7-Flash-Claude-Opus-4.5-High-Reasoning-Distill-GGUF`). Read
straight out of the GGUF header, it is a real MoE: 64 experts, 4 routed per token,
1 shared expert, ~2.6B active of ~30B.

It cannot answer interactively — its weights are larger than the GTX 1080's 8 GB,
so part of the expert routing lands on the CPU and generation crawls. So it never
touches a draw. It runs at 04:23, writes a handful of cards through the same
schema and the same quality rules as everything else, and drops them into
`.data/corpus/deepened.json`. From then on they are curated cards: instant, and
mixed in with the hand-written ones by the ordinary draw. The hand-written seeds
are never touched.

```bash
./scripts/deepen-night.sh 3          # three cards, start to finish
systemctl --user start murmur-deepen.service
systemctl --user list-timers 'murmur*'
```

The first card it actually produced, unedited, is in `.data/corpus/deepened.json`:

> **Kinematic Disruption Surface** · abstract · mechanics, architecture, intelligence
> A horizontal surface showing partial building disintegration during earthquake
> motion, with control systems still active.
> *The problem:* the impossible state of a control system operating while the
> structure it serves fails, displaying reading errors from a temblor's peak
> acceleration phase where uncertainty exceeds signal clarity.
> *At the easel:* Paint a horizontal surface showing a building's control interface
> during disintegration, with sensor readings displaying total signal loss as the
> frame tilts, apply steel gray and yellow with heavy impasto where stress points
> would be, arrange the center canted with shadows casting long from a single high
> light at 45° making the surface look like it's fracturing under weight, then coat
> everything.

It is more numerically specific than the hand-written seeds — six inches of cant, 3°
of rotation, 45° of light, and a medium you could buy. It is also flatter, and reads
like a specification rather than like the seeds. That is the honest trade: the Opus
distillation gives it vocabulary and confidence the 8B lacks, not an artist's hand.

The script owns the model server's whole life — start, load, deepen, stop — because
a `llama-server` left running holds the card and the deck measurably crawls
(10s → 27s per draw, measured). Before it starts it stops `open-webui.service` and
restarts it afterwards, then asks Ollama to release whatever it holds, twice: that
unit carries `OLLAMA_KEEP_ALIVE=24h`, so it re-loads `llama3.2:3b` within a minute
of any unload and the MoE then dies with `cudaMalloc out of memory` on a 5.8 GB
contiguous model buffer it cannot get.

It runs through llama.cpp's Vulkan backend, not CUDA: nvcc 12.5 on this box cannot
parse GCC 16 headers, so no CUDA build of llama.cpp will compile here. `--n-gpu-layers`
is deliberately **omitted** — asking for all 48 layers fails with
`cudaMalloc out of memory`, and letting llama.cpp fit what it can is what fills the
card.

**How much actually lands on the GPU**, measured from the VRAM delta rather than
assumed: the quant in use is `iq3_xs`, 11.77 GiB of weights, and the server takes
6,298 MiB of VRAM, of which ~211 MiB is context and ~123 MiB is scratch. That leaves
**≈5,950 MiB of weights on the card — about 50%**. Half is the ceiling here, not a
tuning failure: an 11.77 GiB model cannot be "mostly resident" on an 8 GiB card.
The next quant down (`iq2_m`, 9.44 GiB) would reach ~69%. Generation runs at
**~1.2 tok/s**, so one card is 332 tokens and takes **4m40s** — six cards is about
half an hour, which is why this is a 04:23 job and not a feature.

The cost of a night is disk and heat, not money: nothing leaves the machine, and
`MURMUR_DEEPEN_COUNT` (default 6) caps it.

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
bun run test           # 87 vitest tests
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

What was cut, and why: Postgres + pgvector (one user, no tenants, a few hundred
rows — there is nothing to retrieve from and nobody to authorise against),
LangGraph (three task classes and no durable state), Temporal or a queue (the only
background work is one batch that runs, appends and exits), MCP (no capability is
reused across clients), Langfuse (nothing to correlate), Supabase, and a second
FastAPI service (the route handlers *are* the API; a separate process would buy
nothing for one client).

## Layout

```
src/lib/schema.ts        the contract: categories, tags, IdeaDraft, Idea, request
src/lib/corpus/seeds.ts  53 curated ideas
src/lib/corpus/deepened.ts  machine-written cards, .data/corpus/deepened.json
src/lib/engine.ts        seeded draw, filter, fuse — pure, no I/O
src/lib/quality.ts       deterministic rules a schema cannot state
src/lib/prompts.ts       versioned prompt text
src/lib/providers/       types.ts · corpus.ts · ollama.ts · llamacpp.ts · parse.ts
src/lib/router.ts        routing policy + fallback, in code
src/lib/store.ts         file-backed saves / dismissals / seen
src/app/api/             ideas · ideas/expand · saved · dismissed
src/components/          deck · idea-card · filter-bar
scripts/deepen-corpus.ts the deepening run
scripts/deepen-night.sh  the deepening run, with the model server's life
```

State lives in `.data/` (gitignored): `saved.json`, `dismissed.json`,
`seen.json` and `corpus/deepened.json`. Writes are temp-file-then-rename, so an
interrupted write cannot truncate a shelf — and because the rename is atomic, a
running deepener never corrupts what the deck is reading.

## Security posture

- The write routes are same-origin only. A page on any other site can otherwise
  POST to this one with the browser's ambient cookies.
- Every card is re-validated on the way in, so the shelf can only ever hold
  cards that satisfy the contract.
- Ollama is called from server code only. Nothing privileged is in the browser
  bundle.
