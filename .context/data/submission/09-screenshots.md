# Screenshots & Thumbnail

Five screenshots are included with this submission, each capturing a
single decisive beat of the AURA demo. They live in
`.context/data/screenshots/`.

## The five beats

| # | File | Beat | Caption |
| --- | --- | --- | --- |
| 1 | `1-idle-control-room.png` | **READY idle** | "READY FOR PRODUCTION · all 10 specialists on standby." Agent Swarm fully populated; brief rail open; Run Studio CTA visible. |
| 2 | `2-running-plan.png` | **Director's plan preview** | The Director's 9-step plan (Brand → Script → Storyboard → Visuals → Motion → Voice → Edit → QA → Human) is visible in the brief rail **before any generation runs**. |
| 3 | `3-approval-modal.png` | **The Human Veto gate** | The Director stops mid-pipeline. The Approval Modal opens: "Approve Sustainable Sneaker Reel?" Approve / Reject buttons. |
| 4 | `4-reject-confirm.png` | **The rejection confirm** | After clicking Reject, a two-step confirm + rejection-reason field appears — Reject is deliberate, never a stray click. |
| 5 | `5-pause-strip.png` | **Production paused — awaiting the human** | The red pause strip appears in the bottom bar after Reject confirms. The Director holds; the human picks a scene and a refinement note. |

These five images, in order, tell the whole story: **visible crew →
plan preview → human gate → deliberate reject → adaptive production**.

## Thumbnail / hero image (recommended)

Use **`1-idle-control-room.png`** (or a custom crop) as the Devpost
submission thumbnail. It shows the AURA control room in its most
photogenic state:

- Left: Agent Swarm with all 10 specialists visible.
- Center: empty Workspace ready for artifacts.
- Right: brief rail open with the Run Studio CTA.

A custom thumbnail would tighten the framing on the Agent Swarm
sidebar and overlay the tagline:

> **AURA — WebMCP Creative Studio**
> 16 tools · 10 agents · 1 human veto

## Where the screenshots come from

The screenshots are produced by the in-app demo harness and committed
to the repo. To re-capture them against a fresh build:

```bash
# Start the studio.
PORT=3010 npm run dev
curl -X DELETE http://localhost:3010/api/webmcp/execute

# Drive the five beats in a browser (manual or scripted).
# Screenshots are saved as PNG to .context/data/screenshots/.
```

## Demo video stills

If the demo video is included (recommended), the same five beats
should appear as still frames at 0:00, 0:15, 0:40, 0:42, and 0:50
respectively — matching the timing in
`.context/data/submission/07-demo-instructions.md` and
`.context/data/demo-run-sheet.md`.
