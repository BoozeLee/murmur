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
# The manual equivalent, for when you want to watch it:
#   ./scripts/deepen-night.sh 3
set -euo pipefail

REPO_DIR=/home/USER/murmur
PORT="${MURMUR_LLAMACPP_PORT:-11436}"
# Twelve a night. The deck is corpus-first now, so this run is the only thing
# growing the pool. From 64 cards it is 28 nights — about four weeks — to reach
# the 400-card ceiling, at roughly ten minutes of writing per night.
CARDS="${1:-${MURMUR_DEEPEN_COUNT:-12}}"
UNIT="${MURMUR_MODEL_UNIT:-murmur-model.service}"
BUN=/home/USER/.bun/bin/bun

cd "$REPO_DIR"

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
