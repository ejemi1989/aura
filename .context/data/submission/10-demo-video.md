# Demo Video

## Recommended format

| | |
| --- | --- |
| **Duration** | 90 seconds (the run sheet's natural length). Longer is fine; shorter cuts the veto beat. |
| **Resolution** | 1440 × 900 (matches the studio's viewport). |
| **Format** | MP4 (H.264), ≤ 200 MB. |
| **Audio** | Optional narration OR captioned only. |

## Recommended script (90s, no narration required)

Captions over a clean screen recording of the live studio at
`http://localhost:3010`:

| Time | Caption | What the screen shows |
| --- | --- | --- |
| 0:00 | "AURA — visible AI production studio. 16 tools, 10 agents, 1 human veto." | Studio idle, Agent Swarm with 10 specialists. |
| 0:05 | "Type a brief." | Right rail: typed or pasted brief. |
| 0:08 | "Run Studio." | Click Run Studio. |
| 0:10 | "The Director plans first." | Brief rail: numbered 9-step plan scrolls in. |
| 0:15 | "The crew executes — you watch every step." | Agent Swarm updates; Workspace tab strip fills with script → storyboard → visuals → clips → voice → captions. |
| 0:38 | "Critic/QA reviewed the cut. Now the Director asks: do you ship?" | Approval Modal opens: "Approve Sustainable Sneaker Reel?" |
| 0:42 | "Reject. The crew adapts — only the scene I flagged." | Click Reject. Confirm step. Pause strip. Pick Scene 3. Type refinement note. Click Remake Scene 3. Designer refreshes the frame. |
| 0:60 | "Re-composed. Re-reviewed. Asking once more." | Re-approval modal opens. |
| 0:72 | "Approve. Campaign complete." | Click Approve. Final video plays. |
| 0:82 | "Export MP4 — the human is still the executive producer." | Export MP4 click. Real video downloads. |
| 0:88 | "Same studio. Any WebMCP agent can drive it." | Cut to: terminal with `curl -X POST /api/webmcp/execute ...` for the same pipeline. Studio UI updates in lockstep. |

## Alternative: narrated version

A 90-second narrated version reads as a 5-beat essay:

> "This isn't a chatbot that generates a video. It's a visible AI
> production team — you can watch every specialist work, interrupt
> any decision, and approve the final cut."
>
> [0–10s] "Create a 30-second Instagram Reel for a sustainable sneaker
> brand. The Director plans the work in stages — Brand, Script,
> Storyboard, Visuals, Motion, Voice, Edit, QA — then the crew
> executes."
>
> [15–40s] "You watch every specialist. Status updates in real time.
> Artifacts land as they're produced."
>
> [40s] "Then the Director stops. 'Requesting your approval before
> shipping.' The Human Veto gate."
>
> [40–60s] "Reject. The Director holds. I pick Scene 3, type 'doesn't
> feel premium — elevate the product hero shot,' and click Remake
> Scene 3. Only that scene regenerates. The rest of the project is
> preserved."
>
> [60–75s] "The crew re-composes, re-runs Critic/QA, and asks once
> more."
>
> [75–90s] "I click Approve. The final cut plays. Export MP4 — and the
> human stays in charge the whole way."
>
> [Closing card] "AURA. WebMCP-native. 16 tools, 10 agents, 1 human
> veto."

## How to record

Easiest: open the studio in Chrome at the demo viewport, drive the
five beats manually, capture the screen with QuickTime Player
(`File → New Screen Recording`). Trim to 90s.

Alternative: drive the studio with the verification harness (the
same harnesses used for Build-mode acceptance tests) and stitch the
screenshots into a video.

## File to upload on Devpost

`aura-demo-90s.mp4` (or whatever Devpost's "Demo Video" field
accepts). The Devpost field label may vary; pick the field that says
"demo video" or similar.

## Files referenced

- `.context/data/submission/07-demo-instructions.md` — the
  run-sheet this video follows.
- `.context/data/submission/09-screenshots.md` — the still frames
  to use if a video isn't included.
- `.context/data/demo-run-sheet.md` — the original 90s run sheet.
