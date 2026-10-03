#!/usr/bin/env bash
#
# One night of corpus deepening, start to finish.
#
# The 30B model needs almost all of the card, and the deck needs the card free.
# So this script owns the model's whole life: it starts the server, waits for the
# weights to land, deepens the corpus, and shuts the server down again — including
# when it fails, because a llama-server left running holds ~7 GB of VRAM and the
# live deck crawls from 10 seconds to nearly half a minute. That has already been
# measured happening once; the trap below is the fix, not a precaution.
#
# The manual equivalent, for when you want to watch it:
#   ./scripts/deepen-night.sh 3
set -euo pipefail

REPO_DIR=/home/USER/murmur
PORT="${MURMUR_LLAMACPP_PORT:-11436}"
CTX="${MURMUR_LLAMACPP_CTX:-4096}"
THREADS="${MURMUR_LLAMACPP_THREADS:-12}"
CARDS="${1:-${MURMUR_DEEPEN_COUNT:-6}}"
GGUF="${MURMUR_LLAMACPP_GGUF:-/home/USER/models/glm-4.7-flash-claude-4.5-opus.iq3_xs.gguf}"
SERVER="${MURMUR_LLAMACPP_BIN:-/home/USER/llama.cpp-moe/build-vk/bin/llama-server}"
# Must match the provider's MURMUR_LLAMACPP_MODEL default, so the request and the
# loaded model are called the same thing.
MODEL="${MURMUR_LLAMACPP_MODEL:-glm-creative}"
LOG=/tmp/opencode/deepen-llama.log

for required in "$SERVER" "$GGUF"; do
  if [ ! -e "$required" ]; then
    echo "deepen: missing $required" >&2
    exit 1
  fi
done

cd "$REPO_DIR"
: > "$LOG"

free_mib() {
  nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1
}

# Open WebUI runs as a user service with OLLAMA_KEEP_ALIVE=24h in its
# environment, which means it re-touches its model within a minute of any
# keep_alive:0 unload. Measured: with it running, Ollama held 2,440 MiB for
# llama3.2:3b and the server below died with
# "allocating 5783.86 MiB on device 0: cudaMalloc failed: out of memory".
# So it is stopped for the night and put back on the way out.
WEBUI_WAS_RUNNING=no
if systemctl --user is-active --quiet open-webui.service; then
  WEBUI_WAS_RUNNING=yes
fi

# Ask Ollama to let go of whatever it is holding. Not because the deck and the
# deepener cannot share the machine, but because they cannot share the card: an
# Ollama model resident at 2.4 GB is 2.4 GB the big MoE cannot have, and every
# megabyte it loses to the CPU costs a measured fraction of its speed. Ollama
# reloads on demand, so this only moves the wait to the next draw.
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
release_ollama() {
  for resident in $(curl -sf "${OLLAMA_HOST}/api/ps" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4); do
    curl -sf -X POST "${OLLAMA_HOST}/api/generate" \
      -H 'content-type: application/json' \
      -d "{\"model\":\"${resident}\",\"keep_alive\":0}" > /dev/null || true
    echo "deepen: asked ollama to release ${resident}"
  done
}
if [ "$WEBUI_WAS_RUNNING" = yes ]; then
  systemctl --user stop open-webui.service
  echo "deepen: stopped open-webui so it cannot reclaim the card"
fi
release_ollama
sleep 2
release_ollama
FREE_BEFORE=$(free_mib)
echo "deepen: ${FREE_BEFORE} MiB of VRAM free before the load"

# No -ngl on purpose. The weights are larger than the card, so asking for all of
# them fails with cudaMalloc out-of-memory; omitting it lets llama.cpp put what
# fits on the GPU and keep the rest on the CPU, which is what we want for a job
# nobody is waiting on.
start_server() {
  setsid "$SERVER" \
    --model "$GGUF" \
    --alias "$MODEL" \
    --host 127.0.0.1 \
    --port "$PORT" \
    --ctx-size "$CTX" \
    --parallel 1 \
    --threads "$THREADS" \
    >> "$LOG" 2>&1 &
  SERVER_PID=$!
}

shutdown() {
  if kill -0 "${SERVER_PID:-0}" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    # Give the weights time to come off the card before the deck needs them.
    for _ in $(seq 1 20); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
  if [ "$WEBUI_WAS_RUNNING" = yes ]; then
    systemctl --user start open-webui.service
    echo "deepen: open-webui back up"
  fi
}
trap shutdown EXIT INT TERM

# One retry, because the only thing that can go wrong here is a load that raced
# a tenant for the last of the card, and the fix for that is to unload again.
for attempt in 1 2; do
  start_server
  echo "deepen: waiting for the model to load (attempt ${attempt}/2)"
  for _ in $(seq 1 600); do
    # While loading, /health answers 503 with a body, so test for the status.
    if curl -sf "http://127.0.0.1:${PORT}/health" 2>/dev/null | grep -q '"ok"'; then
      break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      if [ "$attempt" = 2 ]; then
        echo "deepen: the model server exited during load; last lines:" >&2
        tail -20 "$LOG" >&2
        exit 1
      fi
      echo "deepen: load lost the race for VRAM, unloading and trying again"
      sleep 5
      release_ollama
      FREE_BEFORE=$(free_mib)
      continue 2
    fi
    sleep 1
  done

  if curl -sf "http://127.0.0.1:${PORT}/health" 2>/dev/null | grep -q '"ok"'; then
    break
  fi
  echo "deepen: model still not healthy after 600s" >&2
  exit 1
done

# The GPU split is the whole reason this is worth running on the card at all, and
# llama.cpp only prints it at -lv 5, which makes --fit re-read the whole 12 GB
# model five times. So it is measured instead: the VRAM the process takes between
# before and after the load is its model buffer plus context plus compute.
FREE_AFTER=$(free_mib)
echo "deepen: ${FREE_BEFORE} MiB free -> ${FREE_AFTER} MiB free; the server holds $((FREE_BEFORE - FREE_AFTER)) MiB of VRAM"
grep -E "offloaded|CUDA0 model buffer|model size" "$LOG" | tail -5 || true

STATUS=0
MURMUR_LLAMACPP_URL="http://127.0.0.1:${PORT}" \
  /home/USER/.bun/bin/bun run scripts/deepen-corpus.ts --count "$CARDS" || STATUS=$?

echo "deepen: model server stopping"
exit "$STATUS"
