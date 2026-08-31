#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BROWSE="$HOME/.claude/skills/gstack/browse/dist/browse"

# 1. Open studio
"$BROWSE" goto http://localhost:3010/ --wait selector "[data-testid='studio-shell'], .studio-grid, [aria-label='Workspace']" 2>&1 | tail -3
sleep 1.2

# 2. Click Audio Mixer tab
"$BROWSE" text "^Audio Mixer$" --action click 2>&1 | tail -2 || true
sleep 0.6

# 3. Click Scene 3 row to anchor voiceover
"$BROWSE" text "^Scene 3\b" --action click 2>&1 | tail -2 || true
sleep 0.4

# 4. Hit Play transport
"$BROWSE" click "name=/Play/i" 2>&1 | tail -2 || true
sleep 1.5

# 5. Snapshot
"$BROWSE" screenshot /tmp/pass27_audio_mixer.png 2>&1 | tail -1 || true

# 6. Pause + Play (verify voiceover does NOT reset)
"$BROWSE" click "name=/Pause/i" 2>&1 | tail -2 || true
sleep 0.5
"$BROWSE" click "name=/Play/i" 2>&1 | tail -2 || true
sleep 1.2
"$BROWSE" screenshot /tmp/pass27_after_pause_play.png 2>&1 | tail -1 || true

# 7. Inspect console for voiceover playback errors
"$BROWSE" console 2>&1 | grep -iE "voiceover|audio|playback" | tail -10 || true

echo "PASS 27 screenshots saved to /tmp/pass27_*.png"
