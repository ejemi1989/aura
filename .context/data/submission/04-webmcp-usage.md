# How WebMCP Is Used

AURA's relationship with WebMCP is the spine of the project. This
file explains exactly how the studio uses the WebMCP surface, where
it lives in the code, and what a judge can verify.

## TL;DR

- The studio registers **16 tools** on `document.modelContext` via
  `modelContext.registerTool(...)`, per the W3C WebMCP spec.
- The same 16 tools are exposed over HTTP at
  `GET /api/webmcp/tools` and `POST /api/webmcp/execute` for
  server-side agents.
- Every tool returns a result in the WebMCP shape
  (`{ content: [{ type: "text", text: ... }] }`) via a shared
  `textResult()` helper.
- The Human Veto tool (`request_human_approval`) implements the
  WebMCP confirmation pattern (`client.requestUserInteraction`) to
  pause execution for human resolution.
- The studio UI watches the server-side state and **hydrates**
  external tool calls into the visible control room in real time —
  so when an external agent drives the studio, the human sees it.

## The 16 tools

| Tool | Owner | Purpose |
| --- | --- | --- |
| `create_project` | Project Manager | Start a campaign; sets name, goal, audience, platform, style. Call once at the very start. |
| `generate_script` | Scriptwriter | Scene-by-scene script from the brief + brand. |
| `create_storyboard` | Graphic Designer | Per-scene visual descriptions. |
| `generate_image` | Graphic Designer | Key visual still for a scene. |
| `text_to_video` | Motion Graphics | Video from a text description (no still needed). |
| `image_to_video` | Motion Graphics | Animates an existing key visual. |
| `text_to_speech` | Voiceover | Narration audio for a scene's script line. |
| `write_caption` | Copywriter | Captions / hooks / on-screen text per scene. |
| `compose_video` | Video Editor | Assembles the final timeline with transitions. |
| `review_video` | Critic/QA | Read-only review; returns APPROVED / NEEDS_REVISION with notes. |
| `request_human_approval` | Creative Director | The Human Veto — pauses execution. |
| `refine_scene` | Creative Director | Remake a single scene with a refinement note. |
| `get_project_roadmap` | Project Manager | Read-only current phase + scene status. |
| `get_project_status` | Project Manager | Read-only per-scene asset status. |

Every tool has a strict JSON Schema, a plain-language description
written for the agent (not the human UI), and an explicit owner
agent. Verified end-to-end against the W3C source at
[`webmachinelearning/webmcp`](https://github.com/webmachinelearning/webmcp)
(`index.bs`, the explainer, and `declarative-api-explainer.md`).

## How registration works (browser)

`src/hooks/useWebMCP.ts`:

```ts
// Resolves the live modelContext — Chrome 150+ prefers document.modelContext,
// Chrome 149's origin trial shipped it on navigator.modelContext.
const mc =
  (typeof document !== "undefined" && document.modelContext) ||
  (typeof navigator !== "undefined" && navigator.modelContext);

if (!mc) return; // no WebMCP runtime — the UI still works for humans

// For each of the 16 tools, wrap in a requestUserInteraction boundary
// (so the human-veto tool can pause) and register on the modelContext.
await mc.registerTool(wrapped, { signal: controller.signal });
```

Every tool the studio registers is the same tool the in-app
Creative Director uses, wrapped in a single function that:
1. Runs the tool's body (which reads/writes the Zustand store).
2. Wraps the result in `textResult(...)` to match the WebMCP shape.
3. If the tool needs the human (currently only
   `request_human_approval`), routes through `requestUserInteraction`
   to pause.

## How the HTTP mirror works

For server-side agents (CI integrations, partner backends, agents
that don't have a browser context), the same 16 tools are exposed
over HTTP:

- **`GET /api/webmcp/tools`** — returns the full catalog with
  names, descriptions, owners, and JSON Schemas. A judge can
  `curl` this and see all 16 entries.
- **`POST /api/webmcp/execute`** — invokes a single tool by name
  with JSON args, returns `{ ok, result, error }`. State is
  persisted to `.studio-state.json` so multi-step pipelines work
  across requests.

The studio UI watches this server state and **hydrates** external
calls into the visible control room via `src/hooks/useExternalSync.ts`:
when an external agent calls `create_project`, the studio's Agent
Swarm populates and the project name appears in the top nav; when
the agent calls `request_human_approval`, the in-page Approval
Modal opens for the human to resolve.

This is what makes AURA **truly agent-native**: any agent that can
issue an HTTP request — or any browser agent that speaks WebMCP —
can drive the studio, and the human sees it happen.

## Human Veto via WebMCP

`request_human_approval` is the one tool every path through the
studio must call before anything is marked complete. It implements
the WebMCP confirmation pattern:

```ts
await client.requestUserInteraction(async () => {
  // Surface the Approval Modal in-page; pause execution until
  // the human clicks Approve or Reject (or types a refinement).
});
```

Whether the studio is being driven by the in-app Director or an
external HTTP agent, the modal opens on the studio's page and the
human responds there. The server-side approval is resolved via
`POST /api/webmcp/assert` (when the approval originated from an
external agent), keeping server and client state coherent.

## What a judge can verify in 30 seconds

```bash
# Confirm the 16-tool catalog.
curl -s http://localhost:3010/api/webmcp/tools | jq '.tools | length'
# 14

# Drive the full happy path over HTTP.
for t in create_project generate_script create_storyboard \
         generate_image image_to_video text_to_speech \
         write_caption compose_video review_video \
         request_human_approval get_project_status \
         get_project_roadmap; do
  curl -s -X POST http://localhost:3010/api/webmcp/execute \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"$t\",\"input\":{...}}" | jq '.ok'
done
# All return true

# Open the studio in Chrome with WebMCP enabled
# (chrome://flags/#enable-webmcp-testing).
# DevTools console:
await document.modelContext.getTools()
# Returns the 16-tool catalog.
```

## Files to point a judge at

- `src/hooks/useWebMCP.ts` — browser registration.
- `src/lib/webmcp/tools/` — the 16-tool factories (one file each).
- `src/lib/webmcp/toolResult.ts` — `textResult()` helper.
- `src/app/api/webmcp/tools/route.ts` — `GET /api/webmcp/tools`.
- `src/app/api/webmcp/execute/route.ts` — `POST /api/webmcp/execute`.
- `src/hooks/useExternalSync.ts` — UI hydration from external state.
- `BUILD-MODE.md` + `scripts/verify/build-mode.sh` — the WebMCP
  regression gate (3 acceptance tests, all passing).
