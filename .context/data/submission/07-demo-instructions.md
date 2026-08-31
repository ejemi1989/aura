# Demo Instructions

A 90-second run sheet for judges. The demo is **zero-key** — the
studio runs end-to-end in demo mode without any external API keys.
Two scripts and one short interaction cover everything.

## Setup (30 seconds, before the judge arrives)

```bash
# 1. Install dependencies (first time only).
npm install

# 2. Start the studio on the demo port.
PORT=3010 npm run dev

# 3. Reset any leftover server state from a previous session.
curl -X DELETE http://localhost:3010/api/webmcp/execute

# 4. Open the studio.
open http://localhost:3010
```

The studio loads into the READY idle state with the Agent Swarm
populated by all 10 specialists.

> **Port note for the demo box:** the demo machine has other services
> pinned to ports `3000` (Grafana), `3001`, and `3002`. The studio
> must run on **3010** — every URL in this doc and the README uses
> 3010 accordingly.

## Demo path 1: In-app Creative Director (the headline demo, 90s)

| Time | Beat | What the judge sees | You do |
| --- | --- | --- | --- |
| 0–10s | Prompt | Monitor reads **READY FOR PRODUCTION · all 10 specialists on standby**. Brief rail open. | Say: *"Create a 30-second Instagram Reel for a sustainable sneaker brand."* Pick a sample brief or type it. |
| 10–15s | Director's plan | The production plan scrolls into the brief rail **before any generation runs**: Brand Strategy → Script → Storyboard → Visuals → Motion → Voice → Edit → QA → Human. | The Creative Director announces the staged plan first. |
| 15–40s | Crew at work | Crew feed fills; artifacts land on the timeline one by one: script → storyboard → key visuals → animated clips → narration → captions. | Point at whichever agent is "active." Name-drop the handoffs. |
| 40s | **Human Veto** (the WOW) | The Director stops: *"Requesting your approval before shipping."* Approval Modal opens. Judge reads *"Approve Sustainable Sneaker Reel?"* | Click **Reject**. A red strip turns on: *"Production paused — awaiting the human."* The Director holds. |
| 40–60s | Veto → remake | Select Scene 3. Type *"doesn't feel premium — elevate the product"*. Click **Remake Scene 3**. The Designer refreshes the frame (`refine_scene`). | *"I interrupted mid-production. Watch the crew adapt, not just finish."* |
| 60–75s | Re-QA + re-approval | Director re-composes, re-runs Critic/QA, and stops again for a second approval. | *"Now it re-reviewed and is asking me once more."* |
| 75–85s | Final approval | Click **Approve**. Final video plays. | End on the veto-then-approve beat. |
| 85–90s | Export | Click **Export MP4** → real video downloads. | *"And the human stays in charge the whole way."* |

## Demo path 2: External WebMCP agent (60s, optional deeper demo)

To prove the studio is **truly agent-native** — that any agent can
drive it, not just the in-app Director:

```bash
# 1. Reset the studio.
curl -X DELETE http://localhost:3010/api/webmcp/execute

# 2. Drive the studio from any terminal with curl — no API keys.
for cmd in \
  'create_project:{"name":"AURA Sustainable Sneaker","goal":"Launch an eco-friendly sneaker","audience":"eco-minded urban professionals","platform":"instagram","style":"premium","targetDurationSeconds":30}' \
  'generate_script:{"sceneCount":4,"keyMessage":"Walk lighter on the planet"}' \
  'create_storyboard:{"visualStyleNotes":"premium, editorial, sustainable-material close-ups"}'; do
  IFS=':' read -r name input <<< "$cmd"
  curl -s -X POST http://localhost:3010/api/webmcp/execute \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$name\",\"input\":$input}" | jq '{ok,name}'
done
# (continue per scene: generate_image, image_to_video, text_to_speech,
#  write_caption; then compose_video, review_video, request_human_approval)
```

While the agent drives the studio, the **studio UI** (still open at
`http://localhost:3010`) reflects every call in real time:

- The Agent Swarm populates as each tool runs.
- The Workspace tab strip fills with artifacts.
- When the agent calls `request_human_approval`, the in-page
  Approval Modal opens. Click Approve — server transitions to
  `phase=complete`.

This is the "agent-native" beat: a server-side agent drove the
studio end-to-end, and the human saw every step.

## Demo path 3: WebMCP in Chrome (60s, optional browser demo)

If the judge wants to drive the studio with a browser agent:

1. Open Chrome 149+ with `chrome://flags/#enable-webmcp-testing`
   enabled, navigate to `http://localhost:3010`.
2. DevTools console:
   ```js
   await document.modelContext.getTools()
   // → returns the 16-tool catalog
   ```
3. Use any WebMCP-capable browser agent to issue natural-language
   intents. The agent will call `create_project`, `generate_script`,
   etc.; the studio UI updates; the human-veto modal opens at the
   end for the human to approve.

## What to do if a judge wants to test error recovery

- Click **Run Studio** three times rapidly → page never breaks.
- Reload mid-run → clean idle state on reload.
- Open DevTools → Network → POST `/api/webmcp/execute` with
  `{name:"do_the_thing", input:{}}` → returns 404 + JSON error,
  no crash.
- POST `{name:"compose_video", input:{}}` after creating an empty
  project → returns a structured error, no crash.

## Files referenced

- `README.md` — full quick-start + clean-startup instructions.
- `BUILD-MODE.md` — the Build-mode contract (6 gates, 39 acceptance
  tests, 3 strategic pauses).
- `scripts/verify/build-mode.sh` — the autonomous Build-mode driver.
- `.context/data/demo-run-sheet.md` — the original 90s run sheet.
- `.context/data/submission/12-positioning.md` — the leading
  one-liner and proof chain.
