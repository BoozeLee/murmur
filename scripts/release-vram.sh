#!/usr/bin/env bash
#
# Free the graphics card for the big MoE.
#
# Ollama will hold a model resident, and open-webui runs as a user service with
# OLLAMA_KEEP_ALIVE=24h in its environment, which means it re-touches its model
# within a minute of any keep_alive:0 unload. Measured on this box: with it
# running, Ollama held 2,440 MiB for llama3.2:3b and the loader died with
# "allocating 5783.86 MiB on device 0: cudaMalloc failed: out of memory".
#
# So the unload is done twice with a pause between: once for the model that is
# there, and once for the one that comes back. That single line is the
# difference between the weights loading in half a minute and not loading at all.
#
# Exits 0 even when Ollama is not running. A missing Ollama is not an error here;
# it just means there is nothing to release.
set -uo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"

if ! curl -sf "${OLLAMA_HOST}/api/ps" > /dev/null 2>&1; then
  echo "vram: ollama is not answering on ${OLLAMA_HOST}; nothing to release"
  exit 0
fi

for pass in 1 2; do
  for resident in $(curl -sf "${OLLAMA_HOST}/api/ps" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4); do
    curl -sf -X POST "${OLLAMA_HOST}/api/generate" \
      -H 'content-type: application/json' \
      -d "{\"model\":\"${resident}\",\"keep_alive\":0}" > /dev/null 2>&1 || true
    echo "vram: asked ollama to release ${resident}"
  done
  if [ "$pass" = 1 ]; then
    sleep 2
  fi
done

exit 0
