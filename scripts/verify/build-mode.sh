#!/usr/bin/env bash
# Build mode — autonomous Build-stage execution with the 3 strategic pauses.
#
# Runs every gate in scripts/verify/, groups results under the three
# strategic pauses from BUILD-MODE.md, and prints a final ship-readiness
# verdict. Each gate script emits PASS/FAIL lines and exits non-zero on
# any failure; this driver aggregates them and pauses at each strategic
# checkpoint so a human (or an agent acting on the human's behalf) can
# confirm before continuing.
#
# Usage:
#   bash scripts/verify/build-mode.sh           # full run with pauses
#   bash scripts/verify/build-mode.sh --no-pause # full run, never stop
#   bash scripts/verify/build-mode.sh pause1    # run only pause 1's gates
#   bash scripts/verify/build-mode.sh pause2
#   bash scripts/verify/build-mode.sh pause3

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"
export PORT="${PORT:-3010}"
export STUDIO_BASE="${STUDIO_BASE:-http://localhost:${PORT}}"

# Colors (only if stdout is a tty).
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; BOLD=''; RESET=''
fi

# Make sure the dev server is up. We don't start it here — Build-mode assumes
# `PORT=3010 npm run dev` is already running (per the README clean-startup).
if ! curl -sf -o /dev/null -m 3 "$STUDIO_BASE/api/webmcp/tools"; then
  echo -e "${RED}dev server not reachable at $STUDIO_BASE${RESET}"
  echo "start it first:  PORT=3010 npm run dev"
  exit 2
fi

MODE="${1:-all}"
PAUSE_GATES=()

case "$MODE" in
  all)
    PAUSE1=(run-in-app-e2e.js run-webmcp-regression.js run-crew-and-qa.js run-workspace-tab-nav.js run-provider-provenance.js run-seed-demo.js)
    PAUSE2=(run-error-recovery.js run-external-bridge.js)
    PAUSE3=(run-submission-readiness.js)
    ;;
  pause1)
    PAUSE1=(run-in-app-e2e.js run-webmcp-regression.js run-crew-and-qa.js run-workspace-tab-nav.js run-provider-provenance.js run-seed-demo.js)
    SKIP_PAUSE=1
    ;;
  pause2)
    PAUSE2=(run-error-recovery.js run-external-bridge.js)
    SKIP_PAUSE=1
    ;;
  pause3)
    PAUSE3=(run-submission-readiness.js)
    SKIP_PAUSE=1
    ;;
  --no-pause)
    PAUSE1=(run-in-app-e2e.js run-webmcp-regression.js run-crew-and-qa.js run-workspace-tab-nav.js run-provider-provenance.js run-seed-demo.js)
    PAUSE2=(run-error-recovery.js run-external-bridge.js)
    PAUSE3=(run-submission-readiness.js)
    SKIP_PAUSE=1
    ;;
  *)
    echo "unknown mode: $MODE"
    exit 2
    ;;
esac

PASS_COUNT=0
FAIL_COUNT=0

run_gate() {
  local script="$1"
  local label="$2"
  echo -e "\n${BOLD}── gate: ${script} (${label}) ──${RESET}"
  if node "scripts/verify/${script}"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

report_pause() {
  local label="$1"; shift
  echo -e "\n${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${YELLOW}  STRATEGIC PAUSE — ${label}${RESET}"
  echo -e "${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════════${RESET}"
}

if [ "${SKIP_PAUSE:-0}" != "1" ]; then
  report_pause "1 — End-to-end production"
fi
for g in "${PAUSE1[@]:-}"; do
  [ -n "$g" ] && run_gate "$g" "Pause 1" || true
done

if [ "${SKIP_PAUSE:-0}" != "1" ]; then
  report_pause "2 — Human Veto + refinement + recovery + external"
fi
for g in "${PAUSE2[@]:-}"; do
  [ -n "$g" ] && run_gate "$g" "Pause 2" || true
done

if [ "${SKIP_PAUSE:-0}" != "1" ]; then
  report_pause "3 — Final demo / submission readiness"
fi
for g in "${PAUSE3[@]:-}"; do
  [ -n "$g" ] && run_gate "$g" "Pause 3" || true
done

echo
echo -e "${BOLD}══════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Build-mode verdict${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════════════${RESET}"
echo -e "  Gates passed: ${GREEN}${PASS_COUNT}${RESET}"
echo -e "  Gates failed: ${RED}${FAIL_COUNT}${RESET}"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}READY TO SHIP${RESET}"
  exit 0
else
  echo -e "  ${RED}${BOLD}NOT READY${RESET} — fix the failing gate(s) above and re-run."
  exit 1
fi
