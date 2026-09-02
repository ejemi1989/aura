# Required Devpost Submission Fields

These are the four narrative fields Devpost asks for on the "Enter a
Submission" page. Use the answers below verbatim or as the basis for
your final draft.

---

## 1. Why your use case is a strong fit for WebMCP

AI video generation today is a black box. A user types a prompt into a
chat box, a model runs for minutes, and a finished video appears. The
user has no visibility into the dozens of decisions that shaped the
output — the script, the storyboard, the visual style, the pacing, the
voice — and no way to interrupt any of them.

AURA is built to make all of those decisions **agent-actuatable** and
**human-visible**. The product is a 10-agent creative production team:
Brand Strategist, Scriptwriter, Copywriter, Graphic Designer, Motion
Graphics, Voiceover, Video Editor, Critic/QA, Project Manager, plus a
Creative Director that orchestrates them. The studio registers every
specialist's job as a WebMCP tool — 14 in total — with natural-language
descriptions and strict JSON Schemas. Any WebMCP-capable agent (Chrome's
built-in agent, an extension, or a server-side agent over HTTP) can pick
up the studio and drive it the same way the in-app Creative Director
does, using the same tools with the same rules and the same human veto.

This is exactly what WebMCP was designed for: a site whose value comes
from coordinated, structured actions — not a chat box. Without WebMCP,
an agent would have to scrape DOM, click buttons, guess at form fields,
and hope the page didn't change underneath it. With WebMCP, AURA
**declares** what it can do and lets the agent do it reliably.

---

## 2. How it creates a better user experience

Two user-visible wins:

**1. The human stays the executive producer.** Before any campaign is
marked complete, the Director calls `request_human_approval`. The
pipeline pauses. An Approval Modal appears in-page. The human reads the
brief summary, sees the artifacts, and chooses Approve or Reject. If
they Reject, they pick the offending scene, type a note ("doesn't feel
premium — elevate the product hero shot"), and click Remake Scene 3.
Only that scene is regenerated. The Director re-composes, re-runs
Critic/QA, and re-requests approval. The rest of the project — the
script, the other scenes, the captions — is untouched.

In a 90-second demo, this is the moment that turns a video generator
into a production studio: the human interrupted mid-production, the
crew adapted, and the final cut is the human's, not the AI's.

**2. The studio is visible.** Every agent's status — Brand Strategist
working on tone, Scriptwriter drafting, Graphic Designer generating key
visual for scene 2 — is visible in the left "Agent Swarm" sidebar in
real time. Every artifact lands in the center workspace tab strip as
soon as it exists. The Debug Panel shows every tool call the studio has
made — by the in-app Director or by any external agent — in one
unified trace. There is no hidden state.

---

## 3. What people and agents can do together that was difficult or impossible before

**Without WebMCP**, an AI agent interacting with a creative tool has two
bad options: (a) scrape the page and guess at how to drive it (brittle,
visual-only, breaks on layout changes), or (b) require the studio to
ship a custom backend integration for every agent framework it wants to
support (vendor lock-in, duplication of state and auth).

**With AURA + WebMCP**, the studio publishes its capabilities once
(`modelContext.registerTool(...)` with strict schemas) and every
WebMCP-capable agent — in any browser, on any platform — can pick up
the studio immediately. Three concrete examples that were difficult or
impossible before:

- **An accessibility agent** can drive AURA on behalf of a creator who
  uses a screen reader — calling `create_project`, `generate_script`,
  etc. — because the tools are declarative and have plain-language
  descriptions, not visual buttons.
- **A brand-compliance agent** (e.g. an internal tool at a company)
  can run a campaign through AURA end-to-end over HTTP via
  `POST /api/webmcp/execute`, watch the studio UI reflect every call
  in real time, and step in only at the human-veto gate — which fires
  on its own dashboard.
- **A user with no prompt-engineering skill** can let Chrome's
  built-in agent (or any browser agent that speaks WebMCP) drive the
  studio the same way a Creative Director would — same tools, same
  rules, same human veto — by issuing natural-language intents to the
  agent. The agent calls the studio's tools; the studio's UI shows
  what's happening; the human approves at the end.

The key shift: AURA doesn't replace human creative direction; it gives
both humans and agents the same structured levers to actuate it.

---

## 4. Briefly explain how you implemented WebMCP

Implementation, top to bottom:

**Tool registry.** `src/lib/webmcp/tools/` — 16 files, one per tool.
Each tool is a small factory that reads and writes the same Zustand
store the in-app Creative Director uses, so in-app and agent paths
share state. Every tool returns `{ content: [{ type: "text", text: ...
}] }` per the W3C spec via the `textResult()` helper in
`src/lib/webmcp/toolResult.ts`.

**Browser registration.** `src/hooks/useWebMCP.ts` resolves the live
`modelContext` (prefers `document.modelContext`, falls back to
Chrome 149's `navigator.modelContext`), iterates the same 16 tools,
wraps each one in a `requestUserInteraction` boundary so any tool can
pause for the human (the veto), and calls
`await modelContext.registerTool(wrapped, { signal: controller.signal })`.
Verified against the W3C source (`webmachinelearning/webmcp/index.bs`)
and the declarative-API explainer.

**Server-side mirror.** `src/app/api/webmcp/` exposes the same 14
tools over HTTP for server-side agents and CI integrations:
`GET /api/webmcp/tools` returns the catalog with full JSON Schemas;
`POST /api/webmcp/execute` invokes a tool by name. State persists to
`.studio-state.json` so multi-step pipelines survive across requests.
The studio UI watches this server state and hydrates — when an
external agent calls `request_human_approval`, the in-page Approval
Modal opens and the human can resolve it there.

**Human veto.** The `request_human_approval` tool implements the WebMCP
confirmation pattern (`client.requestUserInteraction`) to pause
execution until the human responds in the on-screen modal — whether the
studio is being driven by the in-app Director or an external agent.

**Verification.** 3 strategic pauses, 19 checklist items, 9 gate
scripts, all passing on a clean dev server
(`bash scripts/verify/build-mode.sh`). The
WebMCP 16-tool regression and the external-agent-to-UI-bridge gates
both end-to-end exercise the WebMCP paths against real Chrome.

**Open source.** MIT license at the repo root (Devpost-detectable).
