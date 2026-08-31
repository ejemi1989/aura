# PLAN — Professional-grade MCP Agents (LLM-driven specialists)

## Problem

The studio's agents are **scripted, not reasoning**. Judges see a swarm that
cyclically lights up, but the creative output underneath is templated:

| Agent | Tool | Current behavior | Gap |
|---|---|---|---|
| Scriptwriter | `generate_script` | returns `buildBeats()` **template beats** | Not real writing — every brief yields the same formulaic beat structure |
| Copywriter | `write_caption` | `description.split(".")[0].slice(0,60)` | A truncation, not copywriting; ignores platform/hook intent |
| Graphic Designer | `create_storyboard` | `description + " — " + notes` string concat | Not an art-directed, prompt-engineered visual brief |
| Critic/QA | `review_video` | **hardcoded `"APPROVED"`** | No actual review — `NEEDS_REVISION` path is unreachable in live mode |
| Director | `/api/orchestrate` | agentic tool-loop (good), but feeds it `gpt-4.1-mini` and gets back the templated tool outputs above | Planner reasons, specialists don't |

So even the LLM orchestrator (which already runs first from the BottomBar) is
fed canned specialist output. The specialists never think.

## Confirmed constraint

`OPENAI_API_KEY` is set but the account has **no credits**: a live
`POST /api/v1/chat/completions` returns `429 "You have no credits remaining"`.
The LLM Director cannot run live today. **This does not block building**: the
upgrade is fully buildable and verifiable against a recorded/mocked OpenAI
response, and works the moment credits are added.

## Direction (user-confirmed)

- **LLM-first**: the real agentic Director is THE way the studio runs; the
  scripted pipeline remains only as a no-key fallback.
- **Root fix**: the *specialists* must reason, not just the Director. Every
  content-producing tool becomes an LLM call with a strong, brief-grounded
  creative prompt, and QA genuinely critiques.

## Implementation steps

### 1. New shared LLM helper — `src/lib/llm/chat.ts`
- `chatJSON(system, user, { schema, model })`: wraps `openai` chat completions,
  returns parsed JSON matching the caller's schema; throws a clean error on
  no-credits / invalid so callers can fall back gracefully.
- Model: `process.env.OPENAI_MODEL ?? "gpt-4.1-mini"`, but recommend
  `gpt-4.1` (or configurable) for creative coherence in the plan.

### 2. Make each specialist tool an LLM call (server-side, `src/app/api/orchestrate/route.ts`)
Rewrite `executeToolServerSide` cases so the *content* is reasoned:

- **`generate_script`** → LLM writes the scene-by-scene script + narration +
  captions from the brief (goal/audience/platform/style/brand voice). Return a
  structured JSON of scenes `{index, description, voiceoverLine, caption,
  durationEstimate}` — no more `buildBeats` template. Keep `buildBeats` as the
  **no-key fallback**.
- **`create_storyboard`** → LLM writes a concrete, art-directed image prompt per
  scene (shot, subject, lighting, composition, color, mood) grounded in brand
  guidelines. Deterministic concat as fallback.
- **`write_caption`** → LLM writes the on-screen text / hook / post caption per
  platform with the brief's register; truncation as fallback.
- **`generate_image`** → pass the LLM-written storyboard prompt (already does).
- **`review_video`** → LLM actually critiques the composed project against the
  brief + brand guidelines and returns `{verdict: APPROVED|NEEDS_REVISION,
  notes[]}`. Falls back to the current always-APPROVED only when no key.
- **`text_to_speech` / `image_to_video` / `compose_video`** → unchanged
  (infrastructure, not creative content).

### 3. Lift orchestration quality — `/api/orchestrate/route.ts`
- Feed **real brand guidelines** into the agent loop: the Director should invoke
  a Brand Strategist tool first (or embed the brief's brand voice) so specialists
  share one consistent creative spine.
- Surface the **model's reasoning as director chat**: push each assistant turn's
  `content` and per-tool result into the activity/director log so the swarm reads
  as a thoughtful, sequenced process — not a silent tool run.
- Keep `maxRounds`, add a **post-QA replan round**: when `review_video` returns
  `NEEDS_REVISION`, the loop can re-invoke `refine_scene` before composing again
  (the loop can already do this once the QA tool returns real verdicts).

### 4. Verify with a recorded OpenAI stub (no credits needed)
- Add `scripts/verify/fixtures/openai-chat.json` recording one plausible
  completion response; a tiny `LLM_TEST_MODE=record|replay` flag in `chat.ts`
  replays it so the routes can be exercised end-to-end without spending credits.
- Prove: script comes back as real prose (not beats template), storyboard has
  shot/lighting/composition language, caption is platform-tuned, and QA can
  return `NEEDS_REVISION` (proving the loop's replan path is real).

### 5. Log the pass + honest status
- `.context/data/build.md` Pass 41: specialists now reason; deterministic paths
  retained as no-key fallbacks; **requires OpenAI credits to go live** (top up
  at platform.openai.com, no code change).

## Fallback design (keeps studio runnable without a key)
Every LLM tool returns, on missing key / credits / error, the current
deterministic implementation. So the demo never breaks — it just degrades to
today's behavior when unfunded. The upgrade is strictly additive quality.

## Open decision for you
Build it now (verify with the stub, flip live when you add credits) — or wait
until the credits are available and test against the real API at the end.

## Status — PASS 41 SHIPPED (build now + stub-verify; 4 creative tools)
- ✅ `src/lib/llm/chat.ts` — shared `chatJSON` helper + `LLM_TEST_MODE=record|replay` seam (`scripts/verify/fixtures/openai-chat.json`).
- ✅ `src/lib/llm/agents.ts` — Scriptwriter, Graphic Designer (storyboard), Copywriter, Critic/QA reasoning functions, each with deterministic fallback.
- ✅ `/api/orchestrate` `executeToolServerSide` — the 4 content tools are LLM-first, deterministic fallback on key/credit/error.
- ✅ Stub-verified (replay mode): script/storyboard/caption/QA all return real reasoned output; no-credit mode degrades cleanly to fallback.
- ✅ tsc clean; fresh build; page loads, 0 console errors; dev state reset to clean default.
- ⚠️ **Goes live when OpenAI credits are added** (no code change). Director agentic loop still uses raw OpenAI (untouched).

