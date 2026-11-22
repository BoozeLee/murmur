[![Gates](https://github.com/BoozeLee/murmur/actions/workflows/gates.yml/badge.svg)](https://github.com/BoozeLee/murmur/actions/workflows/gates.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)

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
| Curated | **what the button does.** 53 hand-written, plus whatever the overnight deepener has written since — organised around six subjects: architecture, design, engineering, development, intelligence, mechanics, wearing her finish: psychedelic, mystic, ethereal, mysterious, astronomic, esoteric | instant (~100ms) |
| Fused | what "take it further" does: a card crossed with a corpus partner | instant |
| Model | a **30B mixture-of-experts** on this machine, writing a fresh card through a JSON Schema it cannot escape. The second button, and the deepener's writer | ~40-65s |

**The deck is corpus-first.** Pressing the first button waits for nothing,
because the writing already happened — overnight, while the machine was idle.
The model is a batch writer here, not a dependency of asking for an idea, so a
`cudaMalloc out of memory`, a failed weight load or a 60-second stall can never
stand between her and a card. The model still answers whenever she asks for
something new on purpose, and a kept card can still be taken further by it; both
are the second button now, captioned with what they cost.

The model never gets the last word when it does answer. Its card is parsed
against the same schema the UI is built from, checked for the five failure modes
JSON Schema cannot express, and repaired once if it fails. If it still fails, the
curated corpus answers and the card says so.

## The model

One model, one job now: writing cards while nobody is waiting.

`GLM-4.7-Flash` is a **30B mixture-of-experts** distilled from Claude Opus
4.5's own high-reasoning output
(`TeichAI/GLM-4.7-Flash-Claude-Opus-4.5-High-Reasoning-Distill-GGUF`). Read
straight out of the GGUF header, it is a real MoE: 64 experts, 4 routed per token,
1 shared expert, ~2.6B active of ~30B.

It runs on the Vulkan build of llama.cpp as a systemd user service,
`murmur-model.service`, started on demand by the two things that ask for it: the
nightly deepener, and an opt-in model draw. The first one waits ~10s while the
weights load, and every later draw finds it warm. When the deck goes quiet for
twenty minutes `murmur-model-idle.timer` stops the server again, because a
resident model holds nearly the whole graphics card.

Because the MoE takes the card, `murmur-model.service` stops `open-webui.service`
on the way up and starts it again on the way down. That unit carries
`OLLAMA_KEEP_ALIVE=24h`, so it re-loads `llama3.2:3b` within a minute of any
unload, and the MoE then dies with `cudaMalloc out of memory` on the contiguous
buffer it cannot get without. Asking Ollama to release the card twice is not
enough; the other tenant has to go.

### Why Vulkan, and why no `--n-gpu-layers`

nvcc 12.5 on this box cannot parse the GCC headers installed here, so no CUDA
build of llama.cpp will compile — two different failures, both in `cudafe++`.
Vulkan through the NVIDIA ICD works and reports the same card. `--n-gpu-layers`
is deliberately **omitted**: asking for all 47 layers fails with `cudaMalloc out
of memory`, and letting llama.cpp fit what it can is what fills the card.

**How much actually lands on the GPU**, measured from the VRAM delta rather than
assumed: the quant in use is `iq2_m`, 9.44 GiB of weights, and the server takes
6,199 MiB of VRAM, of which ~211 MiB is context and ~123 MiB is scratch. That
leaves **≈5,865 MiB of weights on the card — about 62%**. The larger `iq3_xs` and
`iq4_xs` quants only reached ~50%, and `iq2_m` is also **~10x faster**: llama.cpp's
own timings report **9.7 tok/s** generating and 47 tok/s on the prompt, against
0.91-1.2 tok/s for `iq3_xs`. That difference is why one card is a ~40-65 second
write here and not a five-minute one — which is what the deepener pays twelve
times a night, and what an opt-in draw pays once.

The same model also works unattended, and unattended is now the only time it
writes. `scripts/deepen-night.sh` runs it at 04:23 to write extra curated cards
through the same schema and the same quality rules, and drops them into
`.data/corpus/deepened.json`. From then on they are curated cards: instant, and
mixed in with the hand-written ones by the ordinary draw. The hand-written seeds
are never touched. Since the deck reads from the corpus by default, this run is
the only thing that grows the pool at all.

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

The script asks for the model the same way a draw does — through
`murmur-model.service`, which owns stopping open-webui so it cannot reclaim the
card and asking Ollama to let go of it. One way to start the model means one set
of bugs. The one thing the script still decides for itself is whether the server
was already up when it arrived, so a deepen run at 04:23 will not switch the
model off under a deck that is using it: it leaves the server running if it
found it running, and stops it if it was the one that woke it.

It is more numerically specific than the hand-written seeds — six inches of cant, 3°
of rotation, 45° of light, and a medium you could buy. It is also flatter, and reads
like a specification rather than like the seeds. That is the honest trade: the Opus
distillation gives it vocabulary and confidence the 8B lacks, not an artist's hand.
It also occasionally degenerates — one measured draw came back with the palette
`pigment A, pigment B, pigment C, pigment D` and an easel line looping the same five
words five times, and still reported itself complete. That is what the deterministic
quality rules and the corpus fallback exist for; a placeholder palette and a stuck
loop are now both rejections.

The cost of a night is disk and heat, not money: nothing leaves the machine, and
`MURMUR_DEEPEN_COUNT` (default 12) caps it — about ten minutes of writing. The
pool itself is capped at 400 cards, and once it is there the run says so and
leaves in under a second, before it loads 9.4 GB of weights to write nothing.
From today's 64 that is about four weeks of nights.

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
bun run test           # 116 vitest tests
```

## How it is put together

The shape follows an architecture report the user chose, applied to a real
requirement and then deliberately cut down. What survived:

- **A closed vocabulary.** Six categories, 65 tags, no free text in either. A
  painter handed "mystical" instead of "esoteric" gets two different paintings,
  and a local model will invent synonyms for her taste every run.
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
src/lib/model-server.ts  starts the model on demand, arms the idle timer
src/lib/router.ts        routing policy + fallback, in code
src/lib/store.ts         file-backed saves / dismissals / seen
src/app/api/             ideas · ideas/expand · saved · dismissed
src/components/          deck · idea-card · filter-bar
scripts/deepen-corpus.ts the deepening run
scripts/deepen-night.sh  the deepening run, reusing the running model server
scripts/ensure-model.ts  start the model server and wait for it
scripts/release-vram.sh  ask Ollama to let go of the card
```

`systemd/` holds the four user units, versioned here and installed to
`~/.config/systemd/user/`. Only one of them is enabled at boot:

- `murmur.service` — the deck, on :3000.
- `murmur-model.service` — the model server. Started on demand, never enabled:
  it must not come up by itself and take the card.
- `murmur-model-idle.timer` — stops the model server twenty minutes after the last
  draw. Every draw restarts it.
- `murmur-deepen.timer` — 04:23, writes extra curated cards.

State lives in `.data/` (gitignored): `saved.json`, `dismissed.json`,
`seen.json` and `corpus/deepened.json`. Writes are temp-file-then-rename, so an
interrupted write cannot truncate a shelf — and because the rename is atomic, a
running deepener never corrupts what the deck is reading.

## Security posture

- The write routes are same-origin only. A page on any other site can otherwise
  POST to this one with the browser's ambient cookies.
- Every card is re-validated on the way in, so the shelf can only ever hold
  cards that satisfy the contract.
- The models are called from server code only — Ollama and llama-server both.
  Nothing privileged is in the browser bundle, and the model server binds to
  loopback.
