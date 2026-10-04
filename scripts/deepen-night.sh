#!/usr/bin/env bash
#
# One night of corpus deepening, start to finish.
#
# This script no longer starts a model server of its own. It asks for one the same
# way a draw does — through murmur-model.service — and the unit owns everything
# that was fiddly: stopping open-webui so it cannot reclaim the card, asking
# Ollama to let go, waiting is somebody else's problem because the caller polls
# /health. One way to start the model means one set of bugs.
#
# What this script still owns is the part only a batch can know: whether the
# server was already up when it arrived. If it was, the run leaves it running for
# the deck; if this run started it, the run shuts it down again, because a
# llama-server left behind holds nearly the whole card.
#
# And it owns the one question worth answering before any of that: is there
# anything left to write? A pool at its ceiling is the end the corpus was given a
# ceiling to reach, so the run says so and leaves. Writing past it would not add
# cards, only minutes and heat.
#
# The manual equivalent, for when you want to watch it:
#   ./scripts/deepen-night.sh 3
set -euo pipefail

# The repo is wherever this script is, so a clone under any name still runs.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${MURMUR_LLAMACPP_PORT:-11436}"
# Twelve a night. The deck is corpus-first now, so this run is the only thing
# growing the pool. From 64 cards it is 28 nights — about four weeks — to reach
# the 400-card ceiling, at roughly ten minutes of writing per night.
CARDS="${1:-${MURMUR_DEEPEN_COUNT:-12}}"
UNIT="${MURMUR_MODEL_UNIT:-murmur-model.service}"
# The systemd units put ~/.bun/bin on PATH; this is the same lookup by hand.
BUN="$(command -v bun || echo bun)"

cd "$REPO_DIR"

# Ask whether there is anything left to write before anything else happens. A
# full pool is the designed end state, not a failure, and finding that out should
# not cost 9.4 GB of VRAM: the answer is a file read, so it belongs above the
# model bookkeeping rather than inside the loop. 3 is deepen-corpus's "the pool is
# full"; every other non-zero code is a preflight that could not answer, which is a
# different thing and must not be reported as a full pool.
PREFLIGHT=0
"$BUN" run scripts/deepen-corpus.ts --preflight || PREFLIGHT=$?
if [ "$PREFLIGHT" -eq 3 ]; then
  echo "deepen: the pool is at its ceiling; there is nothing left to write"
  exit 0
fi
if [ "$PREFLIGHT" -ne 0 ]; then
  echo "deepen: could not read the corpus to see whether it is full" >&2
  exit 1
fi

free_mib() {
  nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1
}

was_up() {
  curl -sf "http://127.0.0.1:${PORT}/health" 2>/dev/null | grep -q '"ok"'
}

# The GPU split is the whole reason this is worth running on the card at all, and
# llama.cpp only prints it at -lv 5, which makes --fit re-read the whole model
# five times. So it is measured instead: the VRAM the process takes between before
# and after the load is its weights plus context plus compute.
FREE_BEFORE=$(free_mib)
WAS_UP=no
if was_up; then
  WAS_UP=yes
  echo "deepen: the model server was already up; leaving it up for the deck"
else
  echo "deepen: ${FREE_BEFORE} MiB of VRAM free before the load"
fi

MURMUR_LLAMACPP_URL="http://127.0.0.1:${PORT}" "$BUN" run scripts/ensure-model.ts || {
  echo "deepen: the model server would not come up" >&2
  exit 1
}

FREE_AFTER=$(free_mib)
echo "deepen: ${FREE_BEFORE} MiB free -> ${FREE_AFTER} MiB free; the model server holds $((FREE_BEFORE - FREE_AFTER)) MiB of VRAM"

STATUS=0
MURMUR_LLAMACPP_URL="http://127.0.0.1:${PORT}" \
  "$BUN" run scripts/deepen-corpus.ts --count "$CARDS" || STATUS=$?

if [ "$WAS_UP" = no ]; then
  echo "deepen: stopping the model server this run started"
  systemctl --user stop "$UNIT"
else
  echo "deepen: leaving the model server running for the deck"
fi

exit "$STATUS"
