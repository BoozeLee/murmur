#!/usr/bin/env bash
#
# Take the graphics card, then let Ollama go of whatever it was holding.
#
# Two things happen here and only here, because both were measured failures:
#
# 1. Open WebUI is a user service with OLLAMA_KEEP_ALIVE=24h in its environment,
#    so it re-touches its model within a minute of any unload. If it is running
#    it is stopped, and a marker is written so restore-card.sh knows to put it
#    back. If it was not running, nothing is started later.
#
# 2. Ollama is asked to release the card. The pause-and-ask-again in
#    release-vram.sh is what makes this stick.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKER=/tmp/murmur-model-stole-webui

if systemctl --user is-active --quiet open-webui.service; then
  : > "$MARKER"
  systemctl --user stop open-webui.service
  echo "card: stopped open-webui so it cannot reclaim the GPU"
fi

"$HERE/release-vram.sh"
exit 0
