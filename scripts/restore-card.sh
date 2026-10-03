#!/usr/bin/env bash
#
# Give the graphics card back to whoever had it.
#
# Runs on every exit of murmur-model.service, including a crash, because the
# alternative is a 10 GB model sitting on the card with nothing using it. The
# marker is what makes this fair: open-webui is only restarted if the model
# server is the thing that stopped it.
set -uo pipefail

MARKER=/tmp/murmur-model-stole-webui

if [ -e "$MARKER" ]; then
  rm -f "$MARKER"
  systemctl --user start open-webui.service
  echo "card: open-webui back up"
fi
exit 0
