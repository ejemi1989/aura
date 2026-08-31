# Demo script (3 minutes)

## 0:00 – 0:20 — The pitch
"This is Creative Studio: an agent-native video production tool. Ten specialist
agents — Brand Strategist, Scriptwriter, Copywriter, Graphic Designer, Motion
Graphics, Voiceover, Video Editor, Critic/QA, Project Manager, and a Creative
Director who runs the room — collaborate through WebMCP tools registered
directly on `navigator.modelContext`. Any WebMCP-capable browser agent can
drive this studio exactly like a human would."

## 0:20 – 0:40 — Show the WebMCP badge and tool registration
Point at the top-right badge: "WebMCP tools registered." Open the Debug
Panel, mention it's currently empty. Say: "Thirteen tools are live right now
— you can inspect them yourself with `await navigator.modelContext.getTools()`
in the console."

## 0:40 – 1:10 — Brief the studio
Fill in the Creative Director panel on the left: campaign name, goal,
audience, platform, style. Click **Run Creative Director**.

Call out the plan message that appears first: "Notice it plans before it
acts — numbered steps, naming every specialist it's about to call, before a
single tool fires."

## 1:10 – 2:00 — Watch it work
Let it run. Narrate what's on screen:
- Agent Swarm panel (right): status dots flipping idle → working → done,
  one agent at a time, sequentially — never two specialists "active"
  simultaneously on a shared resource.
- Workspace (center): storyboard thumbnails filling in scene by scene as
  Graphic Designer and Motion Graphics complete their tool calls.
- Debug Panel (bottom right): every `generate_image`, `image_to_video`,
  `text_to_speech`, `write_caption` call, with real inputs/outputs — this is
  what a technical judge should open.

## 2:00 – 2:30 — Human veto
When the Approval Modal appears: "This is the human veto — `request_human_approval`
pauses agent execution and won't resume until a person decides. Nothing gets
marked complete, and nothing would ever get published, without this gate."
Click **Approve**.

## 2:30 – 2:50 — QA loop (optional, if time)
If you want to show the revision loop: intentionally leave a scene without a
caption before running, so Critic/QA returns `NEEDS_REVISION` and you can
point out the Creative Director automatically replanning the minimum fix
before re-composing and re-reviewing — not looping forever, not silently
shipping a flawed cut.

## 2:50 – 3:00 — Close
"Everything you just watched runs with zero API keys — that's the
deterministic Director in demo mode. Swap in `OPENAI_API_KEY` and it's the
same tool surface, driven by a real model instead, over the exact same
WebMCP tools an external browser agent would use. One tool layer, two ways
to drive it."

---

## Fallback plan
If live generation/network is flaky at the venue: the app never makes real
network calls for image/video/voice in demo mode (they're deterministic
placeholders), so the live run itself has nothing to fail. If you want a
guaranteed cutaway shot regardless, drop a pre-rendered clip at
`public/assets/hero-video.mp4`.
