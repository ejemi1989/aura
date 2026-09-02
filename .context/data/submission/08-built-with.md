# Built With

AURA is built with a deliberately small, mainstream stack so judges
can read the code, run the studio, and verify the WebMCP surface
without specialized tooling.

## Core stack

| Layer | Technology | Why this choice |
| --- | --- | --- |
| **Framework** | **Next.js 14.2** (App Router) | First-class React + server routes in one project; lets WebMCP tools live as API routes alongside the UI. Stable, widely understood. |
| **UI** | **React 18** + **Tailwind CSS v3.4** | Tailwind utility classes for the 3-column control-room layout; no CSS framework lock-in. |
| **Type** | **Geist** (Vercel) | Clean editorial sans for both UI text and monospace. |
| **State** | **Zustand 4** | A single store holds project, scenes, agents, activity. Both the in-app Director and the WebMCP tools read/write the same store — so state is coherent across paths. |
| **Language** | **TypeScript** strict | Catches WebMCP schema drift at compile time. |
| **Validation** | Hand-rolled JSON Schema validation on the server side | WebMCP tools accept strictly-typed inputs; the server validates and returns structured errors. |

## WebMCP

| | |
| --- | --- |
| **Browser surface** | `document.modelContext` (Chrome 150+), `navigator.modelContext` (Chrome 149 origin trial). Verified against the W3C source at `webmachinelearning/webmcp` (`index.bs`, the explainer, and `declarative-api-explainer.md`). |
| **Server mirror** | HTTP at `GET /api/webmcp/tools`, `POST /api/webmcp/execute`, `GET /api/webmcp/get_state`, `POST /api/webmcp/assert`. Same 16 tools, same JSON Schemas, same error shape. |

## Generative providers (optional, demo-mode by default)

The studio runs **zero-key** in demo mode. Real providers are
configurable via `.env.local`. With keys set, `/api/generate/*` routes
call the configured provider; without keys, they fall back to
deterministic placeholder assets so the studio stays runnable.

| Capability | Default | Alternative(s) | Env var |
| --- | --- | --- | --- |
| Image generation | OpenAI `gpt-image-1` | fal.ai, Replicate | `OPENAI_API_KEY` or `FAL_KEY` or `REPLICATE_API_TOKEN` |
| Text-to-speech | Speechify (via `@speechify/api`) | OpenAI `gpt-4o-mini-tts` | `SPEECHIFY_API_KEY` or `OPENAI_API_KEY` |
| Text-to-video | **Google Veo 3** (`veo-3.0-generate-preview`) | fal.ai (Kling), Runway, Luma, Replicate | `GOOGLE_API_KEY` (recommended) or `FAL_KEY` |
| Image-to-video | **Google Veo 3** (`veo-3.0-generate-preview`) | fal.ai (Kling), Runway, Luma, Replicate | `GOOGLE_API_KEY` (recommended) or `FAL_KEY` |
| Compose (assembly) | ffmpeg (local binary) | scene manifest slideshow | `ffmpeg` on `$PATH` |
| LLM Director | OpenAI `gpt-4.1-mini` | any OpenAI chat model | `OPENAI_API_KEY` |

When `DEMO_MODE=true` (default), every generation route that has no
matching key returns a deterministic placeholder. Set
`DEMO_MODE=false` in production to make missing-provider return a 503
instead.

## Verification

| | |
| --- | --- |
| **Browser automation** | `playwright-core` driving system Chrome (macOS). |
| **Test harness** | `scripts/verify/` — 3 strategic pauses, 19 checklist items, 9 gate scripts, all passing. |
| **Build-mode driver** | `scripts/verify/build-mode.sh` — runs the 3 strategic pauses and reports per-checklist-item pass/fail. |

## What's NOT used (deliberately)

- **No backend database.** Project state persists to
  `.studio-state.json` on the server. Easy to inspect, easy to
  reset (`DELETE /api/webmcp/execute`).
- **No agent framework.** The Director is a small
  orchestrator (`directorOrchestrator.ts`) — not LangChain, not
  CrewAI. Easier to read, easier to verify.
- **No LLM call in the demo path.** The deterministic Director
  drives the studio end-to-end without an API key, so judges can
  verify the studio works without setting up provider keys. The
  LLM-driven path (`/api/orchestrate`) is wired and tested but not
  the demo path.

## Open source dependencies (key ones)

- `next` 14.2.35
- `react` / `react-dom` 18.3
- `zustand` 4.5
- `tailwindcss` 3.4 + `autoprefixer` + `postcss`
- `clsx` + `tailwind-merge` (class composition)
- `@types/node`, `@types/react`, `@types/react-dom`, `typescript`

All permissively licensed (MIT, Apache-2.0, BSD). No telemetry, no
tracking, no analytics.

## License

**MIT** — see `LICENSE` at the repo root. Detectable by Devpost's
license scanner.
