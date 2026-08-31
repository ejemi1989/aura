# Creative Studio

An agent-native multi-agent video creative studio, built for the OpenAI
WebMCP Challenge. Ten specialist AI agents — Creative Director, Brand
Strategist, Scriptwriter, Copywriter, Graphic Designer, Motion Graphics,
Voiceover, Video Editor, Critic/QA, and Project Manager — collaborate through
tools registered on the browser's `navigator.modelContext`, in a shared
workspace a human can watch and steer live.

## Why WebMCP, specifically

Instead of an AI browser agent guessing what a button on this page does, the
page declares its actions directly: 16 tools, each with a plain-language
description, a strict JSON Schema, and an explicit owner agent. Any
WebMCP-capable agent (Chrome's built-in agent, or any other browser agent
that speaks the standard) can pick up this studio and run it exactly the way
the in-app Creative Director does — same tools, same rules, same human veto.

This implementation is checked directly against the spec source at
[webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
(`index.bs`, the explainer README, and `declarative-api-explainer.md`), not
just secondhand docs. Two details worth knowing if you extend this:

- **`document.modelContext`, not `navigator.modelContext`.** The spec defines
  `partial interface Document { readonly attribute ModelContext modelContext; }`.
  Chrome's origin trial originally shipped it under `navigator` in Chrome 149
  and moved it to `document` in Chrome 150 to match the spec. `useWebMCP.ts`
  checks `document.modelContext` first and falls back to `navigator.modelContext`
  so it keeps working across that transition.
- **`registerTool()` is synchronous and throws, not rejects.** Its IDL return
  type is `undefined`, and it throws `InvalidStateError` (duplicate/empty
  tool name) or `NotAllowedError` (the `tools` permissions-policy feature is
  disabled) synchronously. `useWebMCP.ts` wraps each registration in
  try/catch accordingly, not `.catch()`.
- **Tool results use the MCP content-block shape.** The spec's own
  `execute` example returns `{ content: [{ type: "text", text: "..." }] }`,
  matching the Model Context Protocol result format this API is deliberately
  modeled on. Every tool in `src/lib/webmcp/tools/` returns that shape via
  the `textResult()` helper in `src/lib/webmcp/toolResult.ts`, rather than a
  bare string.

## Quick start

```bash
npm install
npm run dev -- -p 3010
```

Open http://localhost:3010. No API key is required — the studio ships in a
fully deterministic **demo mode** (see below) so the whole pipeline is
runnable and judgeable with zero setup.

> **Port note for this machine:** the demo box has other services pinned to
> `3000` (Grafana), `3001`, and `3002`, so the studio must run on **3010** —
> `PORT=3010 npm run dev` (or `npm run dev -- -p 3010`). Every URL in this
> README uses port 3010 accordingly.

To enable a real LLM-driven Creative Director instead of the deterministic
one, copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`.

WebMCP itself requires Chrome 149+ with the origin trial flag enabled, and
HTTPS in production (`localhost` counts as a secure context for local dev).
Without it, the app still works fully for a normal visitor — WebMCP is an
extra lane for agents, never the only lane.

## Three ways to drive the studio

1. **In-app Creative Director** (`src/lib/agents/directorOrchestrator.ts`):
   fill in a brief in the right rail and click "Run Studio." This runs the
   full pipeline deterministically, client-side, calling the same `/api/*`
   routes an external agent would. Zero keys required.
2. **External WebMCP agent in the browser**: once the page loads, every
   tool is registered on `document.modelContext` (Chrome 150+ matches
   the spec; Chrome 149's `navigator.modelContext` is also supported).
   Any browser AI agent can inspect them with
   `await document.modelContext.getTools()` and drive the studio directly.
3. **External WebMCP-aware agent over HTTP**: for server-side agents,
   CI integrations, or partner backends that don't have a browser
   context, the same 16 tools are exposed at
   `GET /api/webmcp/tools` (catalog) and `POST /api/webmcp/execute`
   (invoke a single tool by name with JSON args). State is persisted
   to `.studio-state.json` so multi-step pipelines work across requests.

All three paths log to the same Debug Panel and agent activity feed, so
there's one unified trace regardless of who's actually calling the tools.

## Clean startup (fresh demo every time)

The studio persists server-side state to `.studio-state.json`. After a
completed run the dashboard may load into a finished project, which is
**not** the intended demo entry point. For a guaranteed fresh 90-second
run:

```bash
# 1. Install (first time)
npm install

# 2. Start on the demo port
PORT=3010 npm run dev
#    or: npm run dev -- -p 3010

# 3. Reset any leftover server state from a previous session
curl -X DELETE http://localhost:3010/api/webmcp/execute
#    (removes .studio-state.json; this also clears any pending human approval)

# 4. Open the studio
open http://localhost:3010
```

Then drive it either way you like:

- **In-app Director:** type (or pick a sample brief) in the right rail →
  click **Run Studio** → watch the pipeline → respond to the approval modal.
  Optionally **Reject**, then **Remake Scene 3** to show the human-veto loop.
- **External agent over HTTP:** `curl` the catalog, then POST tool calls,
  and the studio UI reflects them live (external origin shows a distinct
  "external" call style and the project hydrates into the control room).

`DELETE /api/webmcp/execute` is idempotent — call it anytime to reset.

## The 16 tools

| Tool | Owner | Notes |
|---|---|---|
| `create_project` | Project Manager | Starts a campaign; call first |
| `generate_script` | Scriptwriter | Scene-by-scene script |
| `create_storyboard` | Graphic Designer | Per-scene image prompts |
| `generate_image` | Graphic Designer | Key visual per scene |
| `text_to_video` | Motion Graphics | Video from text, no still needed |
| `image_to_video` | Motion Graphics | Animates an existing key visual |
| `text_to_speech` | Voiceover | Narration per scene |
| `write_caption` | Copywriter | Hook lines, on-screen text, post captions |
| `compose_video` | Video Editor | Assembles the final timeline |
| `review_video` | Critic/QA | Read-only; returns APPROVED / NEEDS_REVISION |
| `request_human_approval` | Creative Director | The human veto — pauses execution |
| `refine_scene` | Creative Director | Targeted remake after a Reject (re-generates one scene, preserves the rest) |
| `get_project_roadmap` | Project Manager | Read-only status/roadmap |
| `get_project_status` | Project Manager | Read-only per-scene asset status |
| `export_video` | Video Editor | Confirms export readiness + reports provider/cost; in-browser agents trigger the download |
| `list_available_providers` | Project Manager | Read-only; reports which generation providers are configured (OpenAI, fal.ai, Speechify, etc.) |

All tool implementations live in `src/lib/webmcp/tools/` — one file per
tool, each a small factory over the Zustand store so `execute` always reads
and writes live state.

## Demo mode vs. production providers

The generation tools (`generate_image`, `text_to_video`, `image_to_video`,
`text_to_speech`, `compose_video`) hit server routes under
`/api/generate/*` that pick the best available provider from environment
variables. With keys set, the routes call real APIs:

| Capability | Default provider | Alternative | Required env var |
|---|---|---|---|
| Image generation | OpenAI `gpt-image-1` | fal.ai, Replicate | `OPENAI_API_KEY` or `FAL_KEY` or `REPLICATE_API_TOKEN` |
| Text-to-speech | Speechify (via `@speechify/api`) | OpenAI `gpt-4o-mini-tts` | `SPEECHIFY_API_KEY` or `OPENAI_API_KEY` |
| Text-to-video | fal.ai queue (Kling) | Runway, Luma, Replicate | `FAL_KEY` (recommended) |
| Image-to-video | fal.ai queue (Kling) | Runway, Luma, Replicate | `FAL_KEY` (recommended) |
| Compose | ffmpeg (local) | n/a | `ffmpeg` on `$PATH` |
| LLM Director | OpenAI `gpt-4.1-mini` | any OpenAI chat model | `OPENAI_API_KEY` |

When no key is set, each route falls back to a deterministic placeholder
asset (a 1×1 PNG for images, a silent WAV for TTS, a 32-byte stub mp4
for video, a scene manifest for compose) so the studio remains runnable
end-to-end. Set `DEMO_MODE=false` in production to make missing-provider
return a 503 instead of a placeholder.

`/api/generate/compose` shells out to ffmpeg when available (transitions:
cut / crossfade / whip-pan / match-cut; xfade filter for non-cut
modes). When ffmpeg is missing it returns a scene manifest the
`VideoPreview` component plays as a slideshow.

## Human veto

`request_human_approval` is the one tool every path through the studio must
call before anything is marked complete. It uses the WebMCP confirmation
pattern (`client.requestUserInteraction`) to pause execution until a human
responds in the on-screen Approval Modal — whether the studio is being
driven by the in-app Director or an external agent.

## Project structure

```
creative-studio/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main dashboard: 3-column shell
│   │   ├── api/
│   │   │   ├── orchestrate/      # LLM-driven Creative Director (needs OPENAI_API_KEY)
│   │   │   ├── webmcp/
│   │   │   │   ├── tools/        # GET catalog of 16 tools (for external agents)
│   │   │   │   └── execute/      # POST any tool by name (server-side state)
│   │   │   └── generate/
│   │   │       ├── image/        # OpenAI gpt-image-1 (or fal/Replicate)
│   │   │       ├── text-to-speech/   # Speechify (or OpenAI gpt-4o-mini-tts)
│   │   │       ├── text-to-video/    # fal.ai Kling (or Runway/Luma/Replicate)
│   │   │       ├── image-to-video/   # fal.ai Kling (or Runway/Luma/Replicate)
│   │   │       └── compose/          # ffmpeg assembly (cut/crossfade/whip/match)
│   ├── components/
│   │   ├── TopNav/               # Project name, share, WebMCP indicator, theme
│   │   ├── AgentList/            # 216px swarm sidebar (status + progress)
│   │   ├── Workspace/            # Video preview + tabbed panel
│   │   ├── BriefPanel/           # 360px right rail: form + sample briefs + log
│   │   ├── BottomBar/            # Prompt input + Run + step counter
│   │   ├── ApprovalModal/        # Human veto
│   │   └── DebugPanel/           # Tool call log + manual "Run a tool" tab
│   ├── hooks/
│   │   ├── useWebMCP.ts          # Registers all tools on document.modelContext
│   │   └── useTheme.ts           # Light/dark with localStorage persistence
│   ├── lib/
│   │   ├── providers/            # OpenAI, fal.ai, http helpers, config
│   │   ├── webmcp/               # Tool catalog, server store, run wrapper
│   │   ├── agents/               # Registry + deterministic orchestrator
│   │   └── store/                # Zustand client store
│   └── types/                    # Shared TypeScript types
├── public/assets/                # Generated images / audio / video land here
└── docs/DEMO_SCRIPT.md
```

## HTTP API for external agents

External agents that don't run inside a browser (server-side orchestrators,
CI pipelines, partner backends) can drive the studio over HTTP. The
contract mirrors the in-app WebMCP surface so an agent can use one set of
schemas for both.

```bash
# 1. Discover the available tools
curl http://localhost:3010/api/webmcp/tools
# → { schemaVersion, studio, capability, toolCount, tools: [...] }

# 2. Invoke any tool by name
curl -X POST http://localhost:3010/api/webmcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_project",
    "input": {
      "name": "Spring Launch",
      "goal": "drive signups for the spring product",
      "audience": "first-time online shoppers, 18-30",
      "platform": "instagram",
      "style": "playful",
      "targetDurationSeconds": 30
    }
  }'

# 3. Continue with the rest of the pipeline...
curl -X POST http://localhost:3010/api/webmcp/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "generate_script", "input": {"sceneCount": 5, "keyMessage": "..."}}'

# 4. Check progress any time
curl -X POST http://localhost:3010/api/webmcp/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "get_project_status", "input": {}}'

# 5. Reset state between runs
curl -X DELETE http://localhost:3010/api/webmcp/execute
```

State is persisted to `.studio-state.json` so multi-step pipelines survive
across separate HTTP requests. For multi-tenant production, swap
`src/lib/webmcp/serverStore.ts` for a Postgres/Redis-backed store keyed
by `projectId`.

## Verifying the WebMCP implementation

- Works fully with WebMCP unavailable (test with the Chrome flag off) — the
  in-app Director path never touches `document.modelContext` / `navigator.modelContext`.
- `await document.modelContext.getTools()` lists all 13 registered tools with
  their `name`, `description`, `inputSchema`, `origin`, and owner `window`.
- `const tool = (await document.modelContext.getTools()).find(t => t.name === "create_project")`
  then `await document.modelContext.executeTool(tool, { name: "Test", goal: "...", audience: "...", platform: "instagram", style: "casual" })`
  dry-runs `create_project` and returns a `{ content: [...] }` result.
- `request_human_approval` correctly blocks until the modal is answered —
  this exercises `client.requestUserInteraction()`.
- Read-only tools (`review_video`, `get_project_roadmap`, `get_project_status`)
  are marked with `annotations: { readOnlyHint: true }`.
- Registering a second tool with a name already in use throws
  `InvalidStateError` synchronously — confirm `useWebMCP.ts`'s try/catch
  around `registerTool()` catches this rather than leaving an unhandled
  rejection.
