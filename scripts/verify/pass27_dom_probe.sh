#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BROWSE="$HOME/.claude/skills/gstack/browse/dist/browse"

js() { "$BROWSE" js "$1" 2>&1 | grep -v "UNTRUSTED\|^$" | tail -3; }

"$BROWSE" goto http://localhost:3010/ --wait selector ".studio-grid" 2>&1 | tail -1
sleep 1.2
"$BROWSE" text "^Audio Mixer$" --action click 2>&1 | tail -1
sleep 0.5
"$BROWSE" text "^Scene 1\b" --action click 2>&1 | tail -1
sleep 0.4

echo "[1] BEFORE Play"
js "JSON.stringify([...document.querySelectorAll('audio')].map(a=>({src:a.src.split('/').pop(),paused:a.paused,t:+a.currentTime.toFixed(2)})))"

"$BROWSE" click "name=/Play/i" 2>&1 | tail -1
sleep 1.2

echo "[2] AFTER Play (T=1.2s)"
js "JSON.stringify([...document.querySelectorAll('audio')].map(a=>({src:a.src.split('/').pop(),paused:a.paused,t:+a.currentTime.toFixed(2),vol:+a.volume.toFixed(2)})))"

echo "[3] Speaking pulse class present?"
js "document.querySelectorAll('.voice-pulse').length"

echo "[4] Audio element count"
js "document.querySelectorAll('audio').length"

"$BROWSE" click "name=/Pause/i" 2>&1 | tail -1
sleep 0.4
echo "[5] AFTER Pause"
js "JSON.stringify([...document.querySelectorAll('audio')].map(a=>({src:a.src.split('/').pop(),paused:a.paused,t:+a.currentTime.toFixed(2)})))"

"$BROWSE" click "name=/Play/i" 2>&1 | tail -1
sleep 0.8
echo "[6] AFTER second Play (same scene — voiceover should NOT reset)"
js "JSON.stringify([...document.querySelectorAll('audio')].map(a=>({src:a.src.split('/').pop(),paused:a.paused,t:+a.currentTime.toFixed(2)})))"
