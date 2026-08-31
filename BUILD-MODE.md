# Build Mode — Autonomous Verification

> **Build mode** is the Build-stage execution mode for AURA. An autonomous
> agent (Codex, or this CLI) drives the studio through every acceptance
> test in the Build checklist, stopping at the three strategic pauses for
> the human to confirm before continuing. The checklist is the contract.

## How to run

```bash
# Dev server must be up (clean startup — see README.md):
PORT=3010 npm run dev

# In another terminal, run the full Build-mode verification:
bash scripts/verify/build-mode.sh

# Run a single pause's gates:
bash scripts/verify/build-mode.sh pause1
bash scripts/verify/build-mode.sh pause2
bash scripts/verify/build-mode.sh pause3

# Or fire-and-forget (no pauses):
bash scripts/verify/build-mode.sh --no-pause
```

Each gate script (`scripts/verify/run-*.js`) emits per-check `PASS`/`FAIL`
lines and exits non-zero on any failure. The driver aggregates them and
prints a final ship-readiness verdict.

If the dev server has been running for a while, call
`curl -X DELETE http://localhost:3010/api/webmcp/execute` first to reset
`.studio-state.json` so every gate sees a clean slate.

---

## The three strategic pauses

The Build checklist has 19 items (16 numbered + 2a, 14a, 10a and 4a sub-rows). They collapse naturally into three
strategic checkpoints where a human must confirm the system before
moving on. Stopping points are deliberate — past each pause, the
remaining work is mechanical and autonomous.

| # | Pause | What it proves | Gates | Why a human pauses here |
| --- | --- | --- | --- | --- |
| **1** | End-to-end production | The pipeline runs cleanly from a clean slate. Every tool is registered. The Director plans, the 10-agent crew executes, and the Critic returns a verdict. The Workspace tab strip supports click + arrow-key + horizontal-swipe navigation. The `SEED_DEMO` toggle atomically hydrates a pre-recorded 4-scene campaign without generation. | `run-in-app-e2e` · `run-webmcp-regression` · `run-crew-and-qa` · `run-workspace-tab-nav` · `run-provider-provenance` · `run-seed-demo` | This is the moment of truth: if the happy path isn't bulletproof, no amount of polish helps. |</oldString>
| **2** | Human Veto + refinement + recovery + external | The veto loop is real (reject → pause → remake → re-approval). The system recovers from rapid clicks, reloads, and bad inputs. An external HTTP agent can drive the studio and see its work reflected in the UI. | `run-error-recovery` · `run-external-bridge` (the veto path is exercised by Gate 1a) | The judge-visible loop (human veto) and the agent-visible loop (external WebMCP) are the two halves of "agent-native." Both must be green. |
| **3** | Final demo / submission readiness | Production build is clean, type-check passes, no secrets, keyless demo mode, gitignore correct, README accurate, 5 Devpost screenshots present, 90-second rehearsal timing fits the demo window. | `run-submission-readiness` | Nothing here is novel, but a single failure (a leaked key, a stale screenshot) is what gets a submission bounced. Verify mechanically. |

---

## The Build checklist

Every row is a contract item. The `Acceptance test` is a concrete
behaviour. The `Verify with` is a runnable command. The `Gate` column
points to the script that contains the assertion; if any `PASS` in the
matching gate fails, the contract is broken.

| # | Checklist item | Acceptance test | Verify with | Gate |
| --- | --- | --- | --- | --- |
| 1 | WebMCP 16-tool regression | `GET /api/webmcp/tools` returns exactly 16 tools including every name in the expected set. | `curl -s $STUDIO_BASE/api/webmcp/tools \| jq '.tools \| length'` prints `16`. | Gate 1b |
| 2 | Fresh end-to-end production run | From an idle studio, `Run Studio` produces the full happy path: Director plan → crew runs → approval modal → `Approve` → Campaign complete. | `node scripts/verify/run-in-app-e2e.js` | Gate 1a |
| 2a | Quick-goal box (LLM-driven with graceful fallback) | The quick-goal input ("Describe a quick goal") re-runs the studio. When `OPENAI_API_KEY` is set it drives `/api/orchestrate` (OpenAI gpt-4.1-mini); when it isn't, it degrades to the deterministic in-app director and still completes. The no-key probe must satisfy `/api/orchestrate` → `mode:"demo"`. | `PASS  quick-goal input present` and `PASS  quick-goal orchestrate probes demo without a key` in Gate 1a output. | Gate 1a |
| 3 | Creative Director planning verification | The Director's plan is previewed in the brief rail **before** any generation runs. | `PASS  Director's plan previewed before generation` in Gate 1a output. | Gate 1a |
| 4 | 10-agent crew / status | The Agent Swarm sidebar renders all 10 specialists with the short labels `Director, Brand, Writer, Copy, Design, Motion, Voice, Editor, Critic, PM`. | `PASS  crew sidebar renders all 10 agents` in Gate 1c output. | Gate 1c |
| 4a | Workspace tab navigation (click / arrow keys / swipe) | The Workspace tab strip (Storyboard / Script / Audio / Timeline) supports three navigation gestures: click, ←/→/Home/End with the tab strip focused, and horizontal pointer drag on the panel content (>60px commits; short drags ignored). Every tab change slides the panel in from the direction of the previous tab. | `PASS` lines in Gate 1d output (`run-workspace-tab-nav.js`). | Gate 1d |
| 5 | Timeline / artifact verification | After a complete run, the timeline strip exposes one entry per composed scene. | `PASS  timeline reflects external scenes` in Gate 2b (uses ≥2 scenes; the in-app run also exposes per-scene entries — verified in Gate 1a's screenshot). | Gate 2b |
| 6 | Human approval gate | The Director pauses for human approval before `phase=complete`. The approval modal opens. | `PASS  human approval gate opens` in Gate 1a output. | Gate 1a |
| 7 | Human rejection → real refinement | Click `Reject` → confirm → the production pause strip appears → `Remake Scene 3` triggers `refine_scene` → re-composition → re-QA → re-approval. | `PASS  reject pauses production (pause strip)` and `PASS  re-approval after revision requested` in Gate 1a output. | Gate 1a |
| 8 | Scene-level override | Selecting Scene 3 and clicking `Remake Scene 3` triggers `refine_scene` with the typed note, applying a patch and regenerating the visual. | Verified inline in Gate 1a (selects scene, fills textarea, clicks Remake, observes re-approval). | Gate 1a |
| 9 | Critic / QA loop | `review_video` returns `ok:true` and the project's `qaVerdict` is set to APPROVED or NEEDS_REVISION. | `PASS  review_video returns ok:true` and `PASS  Critic/QA verdict present` in Gate 1c output. | Gate 1c |
| 10 | Provider-independent demo resilience | The whole pipeline is runnable with **zero API keys** — `OPENAI_API_KEY`, `FAL_KEY`, `SPEECHIFY_API_KEY`, etc. all unset. Every generation route falls back to a deterministic placeholder asset. | `PASS  demo mode is keyless (no provider keys set in harness)` in Gate 3 output. | Gate 3 |
| 10a | Judge-safe dead-man switch (`DEMO_MODE=enforced`) | A deployed demo instance can **never** bill a real provider: setting `DEMO_MODE=enforced` forces every provider selector (image / tts / text-to-video / image-to-video) to `demo` even when API keys are present, and `list_available_providers` reports the enforced state. This makes the Human Veto "Remake" path cost-free for judges. | `PASS  DEMO_MODE=enforced short-circuits provider selectors in config.ts` and `PASS  list_available_providers surfaces enforced mode` in Gate 1e output. | Gate 1e |
| 11 | Error / state recovery | Triple-clicking `Run Studio` is idempotent. Reload mid-run returns to a clean idle. Unknown tool calls return 404 with JSON. Empty `compose_video` returns a JSON error, not a crash. | `PASS  rapid multi-click Run leaves page alive`, `PASS  reload mid-run recovers`, `PASS  unknown tool -> structured error`, `PASS  empty compose -> structured error (no crash)` in Gate 2a output. | Gate 2a |
| 12 | UI / control-room polish | Five Devpost screenshots are present and timestamped. The README accurately describes the demo (port 3010, 16 tools). The demo run sheet reflects the actual flow. | `PASS  5 Devpost screenshots present` and `PASS  README mentions port 3010` and `PASS  README says '16 tools'` in Gate 3 output. | Gate 3 |
| 13 | Production build / type-check | `npx tsc --noEmit` exits 0. `npm run build` exits 0. | `PASS  tsc --noEmit clean` and `PASS  npm run build clean` in Gate 3 output. | Gate 3 |
| 14 | 90-second demo rehearsal | An in-app pipeline run (auto-approving the gate) finishes in **≤ 90 seconds**. | `PASS  90s rehearsal finishes under 90 seconds (deterministic demo mode)` in Gate 3 output. | Gate 3 |
| 14a | Seed-mode demo (pre-recorded artifacts) | With `SEED_DEMO=true`, `create_project` hydrates all 4 scenes from `public/assets/seed/aura-demo/manifest.json` (image/video/weaver metadata, 30s durations) with `phase=assets`, so the Human Veto gate still fires but no provider is billed. Without the toggle, creation is the normal empty-project path. | `PASS` lines in Gate 1f output (`run-seed-demo.js`). | Gate 1f |
| 15 | Backup demo + screenshots | Five screenshots (`1-idle`, `2-running-plan`, `3-approval-modal`, `4-reject-confirm`, `5-pause-strip`) exist in `.context/data/screenshots/`. | `PASS  5 Devpost screenshots present` in Gate 3 output. | Gate 3 |
| 16 | Final Devpost handoff | README, run sheet (`demo-run-sheet.md`), and build log (`build.md`) are all current. `.studio-state.json` is gitignored so a fresh clone starts clean. No hardcoded secrets in `src/`. | `PASS  .studio-state.json is gitignored`, `PASS  .env is gitignored`, `PASS  no hardcoded secrets in src/` in Gate 3 output. | Gate 3 |

### Where the Human Veto lives across the pauses

Item 6, 7, and 8 all exercise the human veto loop. They sit in Gate 1a's
single in-app E2E, **not** Pause 2 — by the time you reach Pause 2, the
veto loop is already proven; Pause 2 only needs to prove *recovery* and
the *external* half of the loop.

---

## Contract for an autonomous executor (Codex)

When handed to Codex (or any other coding agent) without further
guidance, the executor is expected to:

1. Make sure the dev server is running on `$STUDIO_BASE/api/webmcp/tools`
   reachable. If not, start it with `PORT=3010 npm run dev` and wait until
   `/api/webmcp/tools` returns 200.
2. Reset server state once: `curl -X DELETE $STUDIO_BASE/api/webmcp/execute`.
3. Run `bash scripts/verify/build-mode.sh --no-pause` and capture the
   output.
4. Report: how many gates passed, how many failed, and for each
   failure, the exact `FAIL` line and the gate it came from.
5. Stop and ask before making any code change to "fix" a failing gate —
   fixing code under autonomous execution is a separate concern from
   verifying it.

For interactive use, drop `--no-pause` to stop at each of the three
strategic checkpoints for human confirmation before continuing.

---

## What this mode does NOT cover (out of scope, by design)

- **Real provider assets** (fal.ai Kling, OpenAI gpt-image-1, Speechify
  TTS). The studio is demo-mode-only at this stage; real-provider paths
  are stubbed in `/api/generate/*` but not end-to-end-verified here.
- **Production deployment** (Vercel, etc.). The dev server is the only
  execution target in Build mode.
- **Cross-browser WebMCP conformance**. The harness drives the system
  Chrome on macOS. Chrome's own WebMCP origin trial is out of scope —
  the studio's HTTP and in-app paths are the contract.

If a real-asset or deployment story is needed, that's a separate mode.
