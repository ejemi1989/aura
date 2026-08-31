# Human Veto — Human-in-the-Loop Story

The Human Veto is AURA's defining move. It's the one tool every path
through the studio must call before anything is marked complete. It's
what makes AURA a production studio rather than a generator.

## Why the Human Veto exists

AI video tools fail in the same way: they produce "almost right"
output, the user wants one thing changed, and the only recourse is to
re-roll the whole thing. That's a slot machine, not a production tool.

A real production tool lets a human **intervene at any point**, on
**a single decision**, and have the rest of the work preserved. AURA's
Human Veto is the most visible expression of that: the Director
plans the crew's work, the crew executes, the Director pauses for
human approval, and the human's decision (Approve or Reject + Remake)
shapes what happens next.

## What happens at the gate

The Director calls `request_human_approval` when the work is ready
for the human. Specifically: after the Video Editor has composed
the timeline and Critic/QA has returned APPROVED.

The pipeline pauses. The in-page Approval Modal opens:

```
┌─────────────────────────────────────────────────┐
│  Approval Required                              │
│                                                 │
│  Approve "Sustainable Sneaker Reel"?            │
│                                                 │
│  All 4 scenes composed and QA APPROVED.         │
│                                                 │
│  [ Reject ]              [ Approve ]            │
└─────────────────────────────────────────────────┘
```

The human reads the summary, optionally inspects the artifacts in
the Workspace tab strip, and clicks Approve or Reject.

### On Approve

The Director calls `request_human_approval` again with a "final
approval" framing. The human clicks Approve. The project is marked
complete; the "Campaign complete" banner appears; Export MP4 is
enabled.

### On Reject

This is where AURA becomes a production studio, not a generator.

1. The human clicks Reject. A confirm step appears (with a
   rejection-reason field) to make Reject deliberate — never a
   stray click.
2. After confirming, a **production pause strip** appears in the
   bottom bar: *"Production paused — awaiting the human."*
3. The human picks a scene in the timeline (e.g. Scene 3) and types
   a refinement note (*"doesn't feel premium — elevate the product
   hero shot"*).
4. The human clicks **Remake Scene 3**. The Director calls
   `refine_scene` with the note, regenerates only that scene's
   visual, recomposes the timeline, re-runs Critic/QA, and
   re-requests approval.

The rest of the project — the script, the other scenes, the
captions, the voice — is **untouched**. The human didn't re-roll the
whole thing; they refined one scene.

## Why this is a Human Veto and not a "review"

Three reasons:

1. **The pipeline cannot complete without it.** `request_human_approval`
   is the one tool every path through the studio must call. The
   server-side state machine won't transition to `phase=complete`
   until it's resolved with `approved: true`. A video editor or
   server-side agent literally cannot ship without the human's
   explicit Approve.

2. **The rejection loop is real.** A Reject doesn't just bounce the
   work — it surfaces the scene-picker, accepts a refinement note,
   and triggers a targeted regeneration. The crew adapts, not just
   finishes.

3. **It's agent-agnostic.** Whether the studio is being driven by
   the in-app Creative Director, a browser agent, or a server-side
   agent over HTTP, the human veto gate is the same: in-page modal,
   in-page resolution, server-side state assertion. No agent can
   skip it.

## The escape hatch (Esc) is deliberate

Esc does NOT silently instant-reject (that was an early bug — a
stray Esc would drop the user straight into the remake loop
without confirmation). Esc now toggles the Reject confirm step; a
second Esc cancels. Reject never resolves a decision on its own.
The footer copy in the modal reflects this.

## What this looks like in the 90-second demo

The veto is the centerpiece of the demo, not a footnote:

- **0–10s** — prompt.
- **10–15s** — Director's plan announced in the brief rail.
- **15–40s** — the crew runs (script, storyboard, visuals, motion,
  voice, captions, edit, QA). Artifacts land visibly.
- **40s** — Director stops: *"Requesting your approval before
  shipping."* Approval Modal appears. The judge reads *"Approve
  Sustainable Sneaker Reel?"*
- **40–60s** — the demo clicks Reject. Pause strip turns red:
  *"Production paused — awaiting the human."* The Director holds.
  The demo selects Scene 3, types *"doesn't feel premium — elevate
  the product hero shot"*, clicks Remake Scene 3. The Designer
  refreshes the frame.
- **60–75s** — Director re-composes, re-runs Critic/QA, re-requests
  approval.
- **75–85s** — Approve. Final video plays.
- **85–90s** — Export MP4. Real video downloads.

The narrator's line at the veto beat: *"I interrupted mid-production.
Watch the crew adapt, not just finish."*

## Files

- `src/components/HumanApproval/ApprovalModal.tsx` — the modal,
  Esc guard, two-step Reject, server assert on server-origin
  approvals.
- `src/components/Banner/ProductionStatus.tsx` — the
  `rejectWaitActive` pause strip.
- `src/lib/agents/directorOrchestrator.ts` — calls
  `request_human_approval` before completing; re-loops on Reject.
- `src/app/api/webmcp/assert/route.ts` — server-side approval
  resolution for external agents.
