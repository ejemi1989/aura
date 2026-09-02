# README — Devpost Entry

This is the long-form submission narrative, written for the Devpost
"Project Description" field. It's built from the per-section files
in `.context/data/submission/` so the long-form stays in sync with
the supporting docs.

---

# AURA — WebMCP Creative Studio

> **AURA turns AI video generation from a black box into a collaborative
> production studio where agents work as a creative crew and humans
> remain the executive producer.**

AURA is a WebMCP-native creative studio for short-form video. A human
(or any WebMCP-capable agent) types a brief — *"30-second Instagram
Reel for a sustainable sneaker brand, premium feel"* — and AURA's
Creative Director plans the work, dispatches 9 specialist agents in
sequence, surfaces every artifact as it lands, runs a Critic/QA
review, and then **pauses for a human approval gate** before the
project is marked complete.

If the human approves, the campaign ships. If the human rejects, they
pick the offending scene, type a refinement note, and the Director
regenerates **only that scene**, re-composes, re-QAs, and re-requests
approval. The rest of the project is preserved.

## What this is

- **A visible AI production studio.** Ten specialists, every one with
  a real, narrow job and a clear "you do NOT do X" boundary.
- **A WebMCP-native surface.** Fourteen tools — one per studio
  capability — registered on `document.modelContext` per the W3C
  spec. Same tools, same rules, same human veto, whether driven by
  the in-app Director, a browser agent, or a server-side agent over
  HTTP.
- **A human-in-the-loop product.** The pipeline cannot complete
  without an explicit human Approve. Reject triggers a targeted
  re-generation, not a re-roll.

## What it looks like

The studio is a 3-column control room:

- **Left** — Agent Swarm: all 10 specialists with live status and
  one-line activity notes.
- **Center** — Workspace: a tab strip (Script / Storyboard / Visuals
  / Clips / Captions) that fills as artifacts are produced, plus a
  video preview.
- **Right** — Brief rail: the brief form, sample briefs, the
  Director's plan, and the execution log.

A bottom bar holds the Run Studio CTA, a live activity feed, and the
production-state banner (which turns red *"Production paused —
awaiting the human"* after a Reject).

## The 10-agent crew

| # | Agent | Job |
| --- | --- | --- |
| 1 | Creative Director | Plans and delegates; never generates final assets itself. |
| 2 | Brand Strategist | Brand guidelines, tone, audience framing. |
| 3 | Scriptwriter | Scene-by-scene script and voiceover lines. |
| 4 | Copywriter | Captions, hooks, on-screen text per scene. |
| 5 | Graphic Designer | Key visual stills per scene. |
| 6 | Motion Graphics | Animates stills to video (image-to-video) or generates from text. |
| 7 | Voiceover | Narration audio per scene. |
| 8 | Video Editor | Composes the final timeline with transitions. |
| 9 | Critic / QA | ONLY reviews; returns APPROVED / NEEDS_REVISION. |
| 10 | Project Manager | ONLY tracks phase, timing, blockers; answers status questions. |

## The 14 WebMCP tools

`create_project` · `generate_script` · `create_storyboard` ·
`generate_image` · `text_to_video` · `image_to_video` ·
`text_to_speech` · `write_caption` · `compose_video` · `review_video` ·
`request_human_approval` · `refine_scene` · `get_project_roadmap` ·
`get_project_status`.

Every tool has a strict JSON Schema, a plain-language description
written for the agent (not the human UI), and an explicit owner
agent. Verified end-to-end against the W3C source at
[`webmachinelearning/webmcp`](https://github.com/webmachinelearning/webmcp).

## Three ways to drive the studio

1. **In-app Creative Director** — fill in a brief in the right rail
   and click Run Studio. Runs the full pipeline deterministically,
   client-side, with zero API keys.
2. **Browser agent over WebMCP** — once the page loads, every tool
   is registered on `document.modelContext`. Any browser AI agent
   can pick up the studio and drive it directly.
3. **Server-side agent over HTTP** — the same 16 tools are exposed
   at `GET /api/webmcp/tools` (catalog) and `POST /api/webmcp/execute`
   (invoke). The studio UI reflects external calls in real time.

All three paths share the same Zustand store, the same Debug Panel,
and the same human veto. There is one studio, with multiple drivers.

## How WebMCP is used (briefly)

- **`modelContext.registerTool(...)`** is called for each of the 14
  tools (`src/hooks/useWebMCP.ts`).
- **Human Veto** uses the WebMCP confirmation pattern
  (`client.requestUserInteraction`) to pause execution until the
  human responds in the in-page modal.
- **Results** are returned in the WebMCP shape
  (`{ content: [{ type: "text", text: ... }] }`) via a shared
  `textResult()` helper.
- The HTTP mirror (`/api/webmcp/*`) exposes the same tools to
  server-side agents and CI integrations.

## Why this is a strong fit for WebMCP

The product's value is in its **structure** — 16 tools, 10
specialists, a human gate. Without WebMCP, an agent would have to
scrape the DOM and guess at buttons. With WebMCP, AURA **declares**
what it can do and lets the agent do it reliably. The same surface
that the human UI uses is the surface any agent picks up.

## What people and agents can do together

- A creator who uses a screen reader can issue natural-language
  intents to a WebMCP-capable agent, which calls AURA's tools.
- An internal brand-compliance agent at a company can run a
  campaign through AURA end-to-end over HTTP, with the human-veto
  gate surfacing in the studio UI when the campaign is ready.
- A judge with no prompt-engineering skill can let Chrome's
  built-in agent drive the studio the same way a Creative Director
  would — same tools, same rules, same human veto.

## Demo

The studio runs **with zero API keys** in demo mode. The deployed live
URL (**https://creative-studio-eight-vert.vercel.app**) runs the same
flow with nothing to install; to run it locally:

```bash
npm install
PORT=3010 npm run dev
curl -X DELETE http://localhost:3010/api/webmcp/execute
open http://localhost:3010
```

Type a brief (or pick a sample), click Run Studio, watch the crew,
and use the Reject flow to see the human veto + targeted re-make.

See `.context/data/submission/07-demo-instructions.md` for the
90-second run sheet, and `.context/data/submission/12-positioning.md`
for the leading positioning.

## Built with

Next.js 14.2 (App Router) · React 18 · Tailwind v3.4 · Geist · Zustand
4 · TypeScript strict · WebMCP (`document.modelContext` /
`navigator.modelContext`) · playwright-core for verification.

Real generative providers (OpenAI, fal.ai, Speechify, Replicate,
Runway, Luma) are wired and configurable; demo mode falls back to
deterministic placeholders so the studio runs without keys.

## Verification

`bash scripts/verify/build-mode.sh` runs the full Build-mode
verification: 3 strategic pauses, 19 checklist items, 9 gate scripts,
all passing. See `BUILD-MODE.md` for the contract.

## Open source

MIT. See `LICENSE` at the repo root.
