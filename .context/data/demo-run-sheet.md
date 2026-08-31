# Demo Run Sheet — 90-Second Judge Script

**Product:** A visible AI production studio — the human is the executive producer.
**Author:** Multi-Agent Creative Studio

> The one-liner for when you introduce it:
> "This isn't a chatbot that generates a video. It's a visible AI production *team* —
> you can watch every specialist work, interrupt any decision, and approve the final cut."

---

## Setup (before the judge arrives)

- `npm run dev` → open the studio (port 3001).
- **Demo needs zero API keys** — real placeholder images render in pure Node, no
  external binaries required.
- Quick pre-flight: type a one-word prompt and hit **Run Studio** to confirm the
  crew feed scrolls. (Optional sanity check only — do it small.)

---

## The 90-second arc

The deterministic happy path (brief → plan → crew → first approval) runs in
roughly 15–25s — fast enough to feel alive, but the pacing after the veto is
yours. The veto is the reliable centerpiece, not a timing gamble.

| Time | Beat | What the judge sees | You do |
| --- | --- | --- | --- |
| **0–10s** | Prompt | Monitor reads **READY FOR PRODUCTION · all 10 specialists on standby**. Brief rail open | Say: *"Create a 30-second Instagram Reel for a sustainable sneaker brand."* Pick a template / type it in the Brief rail. |
| **10–15s** | Director's plan | The production plan scrolls in the Brief rail *before any generation*: Brand Strategy → Script → Storyboard → Visuals → Motion → Voice → Edit → QA → Human | The Creative Director announces the staged plan first. |
| **15–40s** | The crew at work (fast) | Crew feed fills; artifacts land on the timeline one by one: script → storyboard → key visuals → animated clips → narration → captions | Point at whichever agent is "active." Name-drop the handoffs. |
| **40s** | **Human Veto** (the WOW) | The Director stops: *"Requesting your approval before shipping."* Approval modal appears. Judge reads *"Approve Sustainable Sneaker Reel?"* | Click **Reject**. A strip turns red: *"Production paused — awaiting the human."* The Director holds. |
| **40–60s** | Veto → remake | Select Scene 3. Type *"doesn't feel premium — elevate the product"*. Click **Remake Scene 3**. The Designer refreshes the frame (refine_scene). | *"I interrupted mid-production. Watch the crew adapt, not just finish."* |
| **60–75s** | Re-QA + re-approval | Director re-composes, re-runs Critic/QA, and stops again for a second approval. | *"Now it re-reviewed and is asking me once more."* |
| **75–85s** | Final approval | Click **Approve**. Final video plays. | End on the veto-then-approve beat. |
| **85–90s** | Export | Click **Export MP4** → real video downloads. | *"And the human stays in charge the whole way."* |

---

## The two things the judge must remember

1. **You can see, control, and intervene** in an AI production team (not a black-box generator).
2. **The human is the executive producer** — veto one call, watch the crew replan, approve, ship.

---

## WebMCP story (if the judge asks "how is this agent-native?")

- The studio registers **14 tools** at the top level via `document.modelContext.registerTool`
  (imperative JS, not the declarative API — correct for the ChatGPT/Codex browser, which
  doesn't discover tools in iframes).
- A live WebMCP agent can `getTools()` → call `generate_image`, `text_to_speech`,
  `compose_video` in sequence and drive the exact same pipeline you just watched.
- **To demo it live:** open the studio in **ChatGPT Desktop** (or Chrome 149+ with the
  origin trial), type the brief, and let the agent drive the crew while you veto a scene.
- It degrades gracefully: no WebMCP support → the in-app Developer/Director still runs it.

---

## Environment notes (known/working)

- **No ffmpeg needed for the demo** — image renderer is pure Node (zlib PNG); video
  falls back to the scene still, and Export produces a real MP4 client-side via
  MediaRecorder canvas capture.
- **Retry/backoff + job-status** hardening is in (`/api/generate/jobs/[jobId]`) for live
  provider mode.
- If you have keys (`.env.local`), the same tools call real OpenAI / fal backends.
