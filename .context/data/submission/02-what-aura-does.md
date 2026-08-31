# What AURA Does

## The short version

AURA is a **visible AI production studio** for short-form video. A
human types (or an agent calls) a brief — *"30-second Instagram Reel
for a sustainable sneaker brand, premium feel"* — and AURA's
Creative Director plans the work, dispatches 9 specialist agents in
sequence, surfaces every artifact as it lands, runs a Critic/QA
review, and then **pauses for a human approval gate** before the
project is marked complete.

If the human approves, the campaign ships. If the human rejects, they
pick the offending scene, type a refinement note, and the Director
regenerates *only that scene*, re-composes, re-QAs, and re-requests
approval. The rest of the project is preserved.

## The longer version

### Inputs

A creative brief — campaign name, goal, audience, platform, style, and
target duration. Either filled in the right-rail form (human path) or
passed as JSON to `create_project` over WebMCP (agent path).

### Process

1. **Creative Director announces a plan** in the brief rail *before
   any generation runs*: Brand Strategy → Script → Storyboard →
   Visuals → Motion → Voice → Edit → QA → Human Approval. This is
   the visible planning step — humans and agents can see what's
   about to happen and why.
2. **The 9 specialists execute in sequence**, each updating its
   status in the Agent Swarm sidebar. Every artifact lands in the
   Workspace tab strip as soon as it's produced — the script as
   text, storyboard as scene descriptions, visuals as stills, clips
   as videos, voice as audio, captions as on-screen text.
3. **Critic/QA reviews the composed video** and returns APPROVED or
   NEEDS_REVISION with actionable notes. (The Director re-loops the
   minimum necessary re-generation if NEEDS_REVISION.)
4. **Human Veto gate**: the Director calls `request_human_approval`.
   The pipeline pauses. The in-page Approval Modal opens for the
   human to read and decide.
5. **Resolution**:
   - **Approve** → project is marked complete. Campaign complete.
   - **Reject** → human picks a scene, types a refinement note, and
     clicks Remake Scene N. The Director calls `refine_scene` on that
     scene only, regenerates the affected asset, re-composes, re-QAs,
     and re-requests approval.

### Outputs

- A composed short-form video with voiceover and captions, on the
  Workspace preview.
- A downloadable MP4 (Export MP4).
- Per-scene artifacts (script, storyboard prompt, visual, video clip,
  voice clip, captions) all inspectable in the Workspace tab strip.
- A Debug Panel showing the full trace of tool calls, useful for
  auditability and debugging.

## Three ways to drive the studio

AURA isn't a single-player app. It's a **production system with
multiple drivers** — all acting on the same 16 tools, the same state,
the same human veto.

1. **In-app Creative Director** (`src/lib/agents/directorOrchestrator.ts`):
   fill in a brief in the right rail and click **Run Studio**. Runs
   the full pipeline deterministically, client-side. Zero API keys
   required.

2. **External browser agent over WebMCP**: once the page loads, every
   tool is registered on `document.modelContext` (Chrome 150+ matches
   the spec; Chrome 149's `navigator.modelContext` is also supported).
   Any browser AI agent can inspect them with
   `await document.modelContext.getTools()` and drive the studio
   directly — same tools, same rules, same human veto.

3. **External server-side agent over HTTP**: the same 16 tools are
   exposed at `GET /api/webmcp/tools` (catalog) and
   `POST /api/webmcp/execute` (invoke a single tool by name). State
   is persisted to `.studio-state.json` so multi-step pipelines work
   across requests. The studio UI reflects external calls in real
   time — the project hydrates into the control room as the agent
   works.

All three paths log to the same Debug Panel and agent activity feed,
so there's one unified trace regardless of who's actually calling the
tools.

## What the human sees at each step

| Step | What appears on screen |
| --- | --- |
| Idle | "READY FOR PRODUCTION · all 10 specialists on standby" with the Agent Swarm populated by all 10 agents and a "Run Studio" CTA in the right rail. |
| Plan | Director's numbered plan scrolls into the brief rail before any generation runs. |
| Crew working | Agent Swarm updates each specialist's status in real time ("Brand Strategist: working on tone", "Graphic Designer: generated key visual for scene 2"). |
| Artifacts landing | Workspace tabs fill as script → storyboard → visuals → clips → captions are produced. |
| QA | Critic/QA returns APPROVED or NEEDS_REVISION with notes in the Director log. |
| Human gate | Approval Modal opens in-page, blocking further execution until the human responds. |
| After approval | "Campaign complete" banner; Export MP4 enabled. |
| After rejection + remake | Director re-composes, re-QAs, re-requests approval — the rest of the project is untouched. |
