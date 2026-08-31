# Positioning

## The one-liner (lead with this)

> **AURA turns AI video generation from a black box into a collaborative
> production studio where agents work as a creative crew and humans
> remain the executive producer.**

## The proof chain (use this to support the one-liner)

> **WebMCP → 16 tools → 10 specialist agents → visible artifacts →
> Human Veto → adaptive production → final video.**

Each arrow is a working thing a judge can verify on the live site:

| Step | What it is | Where to look |
| --- | --- | --- |
| **WebMCP** | The studio registers itself on `document.modelContext` via `modelContext.registerTool(...)` per the W3C spec (`src/hooks/useWebMCP.ts`). Chrome 150+ picks it up automatically; Chrome 149's origin-trial `navigator.modelContext` is also supported. | DevTools console after the page loads: `await document.modelContext.getTools()` returns the full catalog. |
| **16 tools** | The complete studio API: `create_project`, `generate_script`, `create_storyboard`, `generate_image`, `text_to_video`, `image_to_video`, `text_to_speech`, `write_caption`, `compose_video`, `review_video`, `request_human_approval`, `refine_scene`, `get_project_roadmap`, `get_project_status`, `export_video`, `list_available_providers`. | `GET /api/webmcp/tools` (the HTTP mirror for server-side agents) or the page console. |
| **10 specialist agents** | Creative Director + Brand Strategist + Scriptwriter + Copywriter + Graphic Designer + Motion Graphics + Voiceover + Video Editor + Critic/QA + Project Manager. Each has a single, explicit role described in plain language. | Left sidebar "Agent Swarm" — all 10 rows visible at idle, each with a short label (Director, Brand, Writer, Copy, Design, Motion, Voice, Editor, Critic, PM). |
| **Visible artifacts** | Every agent's output lands on the timeline as it happens: script, storyboard prompts, key visuals, video clips, narration, captions. | Center "Workspace" tab strip — Script / Storyboard / Visuals / Clips / Captions. |
| **Human Veto** | Before the campaign is marked complete, `request_human_approval` pauses the pipeline and surfaces an in-page Approval Modal. The human can Approve or Reject. | The Modal — fires automatically before the final phase. |
| **Adaptive production** | On Reject, the Director re-composes only the affected scene via `refine_scene`, re-runs Critic/QA, and re-requests approval. The rest of the project is not regenerated. | After clicking Reject → pick Scene 3 → "doesn't feel premium — elevate the product hero shot" → Remake Scene 3. |
| **Final video** | Composed timeline with voiceover and captions, QA-verdict APPROVED, human-approved. | "Campaign complete" banner; Export MP4 produces the deliverable. |

## Three-second elevator

AI video tools are black boxes: type a prompt, get a video, hope for the
best. AURA is a **visible AI production team** — 10 specialists you can
watch, an executive producer you stay, and a WebMCP interface any agent
can pick up and drive. Same tools. Same rules. Same human veto.

## One-line differentiator vs. the existing landscape

- vs. **prompt-to-video tools** (Sora, Runway, etc.): those are
  generators. AURA is a production team with planning, review, and a
  human-in-the-loop veto.
- vs. **agent frameworks** (LangChain, CrewAI, etc.): those are
  backends. AURA ships a control room where a human can see every
  specialist's status, watch artifacts land in real time, and interrupt
  any decision.
- vs. **chat-based creative copilots**: those are conversations. AURA
  produces a finished, QA-reviewed, human-approved video — with a
  full tool surface any browser agent can drive.
