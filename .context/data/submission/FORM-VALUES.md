# Devpost Form Values — Paste-Ready

All form fields answered from evidence + your selections, ready to paste
into the Devpost "Enter a Submission" page.

---

## Profile / about-you fields

| Field | Value |
| --- | --- |
| **Country of residence** | Nigeria |
| **Submitter type** | Individual |
| **App status** | Newly created during the Hackathon Submission Period |
| **Learning level** | Intermediate — some AI/ML experience |
| **Career AI value** | Very high — central to my career goals |

---

## Project fields

| Field | Value |
| --- | --- |
| **Project title** | AURA — WebMCP Creative Studio |
| **Tagline** | AURA turns AI video generation from a black box into a collaborative production studio where agents work as a creative crew and humans remain the executive producer. |
| **Short description** (1-2 sentences) | A WebMCP-native creative studio: 16 tools, 10 specialist agents, and 1 human veto. Any agent that speaks WebMCP can drive it; the human stays the executive producer. |
| **Categories** *(if Devpost asks)* | AI, Developer Tools, Creative, Video |
| **Built with** *(if Devpost asks)* | Next.js 14.2 · React 18 · Tailwind v3.4 · Geist · Zustand 4 · TypeScript · WebMCP · OpenAI · fal.ai · Speechify · ffmpeg |

---

## Required narrative fields

Full draft answers are in `.context/data/submission/11-required-hackathon-questions.md`.
Short summaries (paste-ready if Devpost has a single text-description
field instead of the 4 split fields):

### 1. Why your use case is a strong fit for WebMCP
AURA's value is in its **structure** — 16 tools, 10 specialists, a
human gate. Without WebMCP, an agent would have to scrape the DOM and
guess at buttons. With WebMCP, AURA **declares** what it can do via
`modelContext.registerTool(...)` with strict JSON Schemas, and lets
the agent do it reliably. The same surface the human UI uses is the
surface any agent picks up.

### 2. How it creates a better user experience
Two user-visible wins: (a) the human stays the executive producer —
the pipeline cannot complete without an explicit Approve at the
human veto gate, and a Reject triggers a targeted re-generation of
only the offending scene; (b) the studio is visible — every agent's
status, every artifact, every tool call is on-screen.

### 3. What people and agents can do together that was difficult or impossible before
Without WebMCP, an AI agent would have to scrape the DOM (brittle,
visual-only) or the studio would need a backend integration per agent
framework (vendor lock-in). With AURA + WebMCP, an accessibility
agent can drive AURA on a creator's behalf; a brand-compliance
agent can run campaigns end-to-end over HTTP and watch the studio UI
update in lockstep; a user with no prompt-engineering skill can let
Chrome's built-in agent drive the studio the same way a Creative
Director would.

### 4. Briefly explain how you implemented WebMCP
- **Tool registry** in `src/lib/webmcp/tools/` — 14 files, one per
  tool, all factories over the same Zustand store.
- **Browser registration** in `src/hooks/useWebMCP.ts`:
  `await modelContext.registerTool(wrapped, { signal })` with the
  WAI-ARIA `requestUserInteraction` pattern for the human veto.
- **Server-side HTTP mirror** at `GET /api/webmcp/tools` and
  `POST /api/webmcp/execute`.
- **Results** in the WebMCP shape via `textResult(...)`.
- **Human Veto** via `client.requestUserInteraction`.
- Verified against the W3C source (`webmachinelearning/webmcp`).
- Verified mechanically by the Build-mode harness: 3 strategic pauses,
  19 checklist items, 9 gate scripts (see `BUILD-MODE.md`).

---

## AI tools leveraged

Paste-ready list:
- OpenAI `gpt-4.1-mini` for the LLM-driven Creative Director
  (optional; demo path runs deterministically without an LLM call)
- OpenAI `gpt-image-1` for image generation (provider route;
  demo-mode fallback when no key)
- OpenAI `gpt-4o-mini-tts` for text-to-speech (provider route;
  demo-mode fallback)
- **Google Veo 3** (`veo-3.0-generate-preview`) for image-to-video and
  text-to-video — Google's flagship video model, accessed via the Gemini
  API's `predictLongRunning` operation (recommended primary; ~$0.35/sec)
- fal.ai (Kling) for image-to-video and text-to-video (recommended
  fallback when Veo 3 is not configured)
- **Seed mode (`SEED_DEMO=true`)**: pre-recorded Veo 3 + OpenAI artifacts
  shipped in `public/assets/seed/aura-demo/` so judges see real assets on
  the deployed URL without the studio burning provider budget per click.
- WebMCP `document.modelContext` / `navigator.modelContext` as the
  agent-actuatable surface — the spine of the project

---

## WebMCP agent/client tested

Tested end-to-end via a server-side HTTP agent driving all 16 tools
through `POST /api/webmcp/execute` (verification Gate 2b, 8/8 PASS).
The studio UI hydrates the agent's calls in real time — project,
timeline, and the human veto modal all appear in-page. The browser
surface (`document.modelContext`) is registered identically via
`modelContext.registerTool(...)` per the W3C WebMCP spec, so any
WebMCP-capable browser agent (Chrome's built-in agent, ChatGPT's
in-app browser) can drive the same 16 tools.

---

## What's still required from you (one-time actions)

Two of the three Devpost artifacts are already in place; one remains.

### 1. Working live URL — DONE
The studio is deployed and verified on **Vercel**:
`https://creative-studio-eight-vert.vercel.app`. No environment variables
are set on the deployment — the demo runs end-to-end in zero-key mode,
and the full pipeline (create → script → storyboard → image → motion →
voice → captions → compose → review → human-gate) was re-verified
against the live URL. Redeploy anytime with `vercel deploy --prod`.

### 2. Public code repository — DONE
Public repo: **https://github.com/ejemi1989/aura** (branch `main`,
MIT `LICENSE` committed, issues enabled, first commit 2026-08-31 —
inside the Hackathon Submission Period). Devpost's license scanner
will pick up the MIT LICENSE automatically.

### 3. <3 min public YouTube demo — REMAINING
The 90-second script is at `.context/data/submission/10-demo-video.md`.
Record the screen at `https://creative-studio-eight-vert.vercel.app`
(no keys needed) driving the beats: idle → plan preview → crew → human
veto → reject + remake → re-approval → complete → export. Upload to
YouTube as unlisted or public, then paste the URL into Devpost.
