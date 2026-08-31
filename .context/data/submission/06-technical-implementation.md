# Technical Implementation

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 14.2** (App Router) | First-class React + server routes; lets WebMCP tools live as API routes alongside the UI. |
| UI | **React 18 + Tailwind v3.4 + Geist** | Tailwind utility classes for the control-room layout; Geist for clean editorial type. |
| State | **Zustand** | A single store holds project, agents, artifacts, activity feed. In-app Director and WebMCP tools both read/write the same store, so state is coherent across paths. |
| Generative providers | **Pluggable** (OpenAI, fal.ai, Speechify, Replicate) | The studio runs **demo mode** with zero keys; provider routes stub to deterministic placeholders when keys are absent. |
| Browser | **Chrome 150+** for `document.modelContext`; **Chrome 149** origin trial on `navigator.modelContext` | Matches the WebMCP spec exactly. |
| Verification | **playwright-core + system Chrome** | Drives real Chrome headlessly to verify WebMCP, the veto loop, and external-agent UI hydration. |

## Architecture (top-down)

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  UI shell    │  │  useWebMCP      │  │ useExternalSync│  │
│  │  (page.tsx,  │←→│  (registers     │←→│ (polls server  │  │
│  │  workspace,  │  │  16 tools on    │  │  state, hy-    │  │
│  │  approval    │  │  modelContext)  │  │  drates client)│  │
│  │  modal, …)   │  └────────┬───────┘  └────────┬───────┘  │
│  └──────┬───────┘           │                    │          │
│         │           WebMCP tools                 │          │
│         │           (tool factory                │          │
│         │            → store)                    │          │
│         │                                        │          │
│  ┌──────▼─────────────────────────────────────────▼─────┐  │
│  │  Zustand store (project, scenes, agents, activity)   │  │
│  └──────┬───────────────────────────────────────────────�  │
│         │                                                   │
│  ┌──────▼──────────────────┐    ┌─────────────────────┐   │
│  │  /api/generate/*        │    │  /api/webmcp/*      │   │
│  │  (provider routes:      │    │  (catalog + execute │   │
│  │   image, tts,           │    │   + get_state +     │   │
│  │   image-to-video,       │    │   assert for the    │   │
│  │   text-to-video,        │    │   human veto)       │   │
│  │   compose)              │    └─────────┬───────────�   │
│  └─────────────────────────┘              │               │
│                                          │               │
│                              ┌───────────▼───────────┐   │
│                              │  .studio-state.json   │   │
│                              └───────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Key files

| Path | Role |
| --- | --- |
| `src/app/page.tsx` | The 3-column control-room shell (Agent Swarm / Workspace / Brief rail). Mounts `useWebMCP` and `useExternalSync`. |
| `src/lib/store/useStudioStore.ts` | Single Zustand store; same store in-app and WebMCP tools read/write. |
| `src/lib/agents/directorOrchestrator.ts` | The deterministic Creative Director that plans and dispatches the 9 specialists. |
| `src/lib/agents/registry.ts` | The 10-agent registry (name, role, "does NOT" boundary, color). |
| `src/lib/webmcp/tools/` | The 16-tool factories. Each is a small function that reads/writes the store and returns a `textResult(...)`. |
| `src/lib/webmcp/toolResult.ts` | The `textResult()` helper. |
| `src/hooks/useWebMCP.ts` | Resolves the live `modelContext`, wraps each tool in `requestUserInteraction`, calls `registerTool(...)`. |
| `src/hooks/useExternalSync.ts` | Polls `/api/webmcp/get_state` and hydrates the client store when idle. |
| `src/app/api/webmcp/tools/route.ts` | `GET /api/webmcp/tools` catalog. |
| `src/app/api/webmcp/execute/route.ts` | `POST /api/webmcp/execute` tool invoker (with structured error responses). |
| `src/app/api/webmcp/get_state/route.ts` | Server snapshot for UI hydration. |
| `src/app/api/webmcp/assert/route.ts` | Server-side approval resolution for external agents. |
| `src/app/api/generate/*` | Pluggable provider routes (image / tts / image-to-video / text-to-video / compose). Demo mode falls back to deterministic placeholders. |
| `src/components/HumanApproval/ApprovalModal.tsx` | The Human Veto modal. Esc toggle, two-step Reject, server assert on server-origin approvals. |
| `src/components/Banner/ProductionStatus.tsx` | Production-state banner with `rejectWaitActive` pause strip. |
| `src/components/AgentList/` | The Agent Swarm sidebar (10 specialists). |
| `src/components/Workspace/` | Tab strip (Script / Storyboard / Visuals / Clips / Captions) + preview. |
| `src/components/BriefPanel/` | Right rail: brief form, sample briefs, Director plan, log. |

## State coherence across paths

AURA has **one** store, not two. Whether the studio is driven by:

- the in-app Creative Director (`directorOrchestrator.ts`), or
- a browser agent calling `document.modelContext.executeTool(...)`, or
- a server-side agent calling `POST /api/webmcp/execute`,

…all three paths mutate the same Zustand store (client-side) which
hydrates from the server snapshot (`.studio-state.json`). The Agent
Swarm updates in real time, the Workspace tab strip fills as artifacts
land, and the human sees every step regardless of who's calling.

The Human Veto is the linchpin: `request_human_approval` pauses
execution; `POST /api/webmcp/assert` resolves server-side approvals
for external agents so server and client state agree when the human
clicks Approve in the in-page modal.

## Provider-independence

The studio is **demo-mode by default** (`DEMO_MODE=true`). Every
`/api/generate/*` route checks for a matching provider key; if
absent, it returns a deterministic placeholder asset (a 1×1 PNG for
images, a silent WAV for TTS, a stub mp4 for video, a scene manifest
for compose). This means the studio runs end-to-end **with zero API
keys** — judges can `curl` and run the studio immediately. Real
providers are wired and configurable via `.env.local`; see
`.env.example` for the full list (`OPENAI_API_KEY`, `FAL_KEY`,
`SPEECHIFY_API_KEY`, `RUNWAY_API_KEY`, `LUMA_API_KEY`,
`REPLICATE_API_TOKEN`).

## Error / state recovery

The studio handles real-world failure gracefully:

- **Rapid multi-click Run Studio** is idempotent — the page never
  breaks. The store guards against double-dispatch.
- **Reload mid-run** recovers to a clean idle state; server state
  persists in `.studio-state.json`.
- **Bad tool inputs** return structured errors
  (`{ ok:false, error:"bad_request", fields:{...} }`) — never
  crashes, never 500-without-message.
- **Orphaned `refine_scene`** (no pending veto) validates its
  fields, applies the patch, regenerates the visual — no
  state-machine corruption. Safe to call ad hoc.

## Build & verification

```bash
PORT=3010 npm run dev          # start the studio
bash scripts/verify/build-mode.sh    # full Build mode, 3 strategic pauses
```

Build mode runs 6 gates and 39 acceptance tests, each with a
concrete verification command. See `BUILD-MODE.md` for the contract.

## Open source

MIT license at the repo root. All dependencies are permissively
licensed. No tracking, no telemetry. The dev server is the only
execution target in Build mode; production deployment is out of
scope for this submission.
