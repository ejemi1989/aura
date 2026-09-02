# AURA — Project Story

## About the project

**AURA** is an agent-native creative studio for short-form video. Instead of
the usual prompt-to-video black box, it is a *visible production team*: ten
specialist AI agents — Creative Director, Brand Strategist, Scriptwriter,
Copywriter, Graphic Designer, Motion Graphics, Voiceover, Video Editor,
Critic/QA, and Project Manager — collaborate through a shared workspace that a
human can watch and steer live.

The studio registers **16 WebMCP tools** on `document.modelContext` (and
mirrors the same contract over HTTP for server-side agents). Any WebMCP-capable
agent can pick it up and drive it exactly the way the in-app Creative Director
does — same tools, same rules, and the same human veto. Before a campaign can be
marked complete, the Director *must* pause and ask the human: **Approve or
Reject?** A Reject doesn't re-roll the whole video; it remakes one scene, then
re-QAs and re-asks.

Short version:

> **AURA turns AI video generation from a black box into a collaborative
> production studio where agents work as a creative crew and humans remain the
> executive producer.**

Demo proof chain: WebMCP → 16 tools → 10 agents → visible artifacts → human
veto → adaptive re-make → final video. Every arrow is live on the deployed site.

---

## Inspiration

A few weeks before the hackathon I watched a teammate try to get a 30-second
product video out of a top-tier text-to-video model. The workflow was brutal:
type a prompt, wait three minutes, watch a video that was *almost* right, and
then type the prompt again with slightly nicer words. Each cycle cost minutes
and money, and each cycle discarded everything from the last one. It wasn't a
production tool. It was a slot machine.

That's when the shape of the problem clicked for me. The thing that makes a
video actually good is not a single prompt — it's a chain of interdependent
decisions:

$$ \text{video} = \big(\text{human gate} \circ \text{QA} \circ \text{compose}
\circ \text{motion} \circ \text{visuals} \circ \text{voice} \circ
\text{storyboard} \circ \text{script} \circ \text{brand}\big)(\text{brief}) $$

A script depends on brand tone. The storyboard depends on the script. The
visuals depend on the storyboard. The motion depends on the visuals. The voice
depends on the script. Each step is a *role* — a real job a human production
house would assign to a different specialist. So the ambitious framing I wanted
to test was: what if a video tool was structured like a studio, not like a chat
box? What if every one of those roles was a named agent you could watch, every
output was an artifact you could inspect, and one agent — the Creative Director —
was answerable to *you*?

Then WebMCP made it feel inevitable. The whole value of a studio lives in its
structure — coordinated, typed, sequential actions. That is *exactly* what
WebMCP was designed to expose to agents. Instead of an agent scraping DOM and
guessing at buttons, the studio could just declare its capabilities with JSON
Schemas and let any WebMCP-capable agent drive them reliably. I wanted to prove,
in one running app, that the same surface a human uses can be the surface any
agent picks up — with the human still holding the final say.

The result is AURA: a 10-agent production crew, a control room a human can sit
in, and a WebMCP tool surface that turns the studio into something *agents can
work at* — not just something agents can look at.

---

## What it does

A human (or any WebMCP-capable agent) gives AURA a brief — *"30-second
Instagram Reel for a sustainable sneaker brand, premium feel"* — and the studio
runs a real production pipeline:

1. The **Creative Director** announces a plan *before* anything generates:
   Brand Strategy → Script → Storyboard → Visuals → Motion → Voice → Edit → QA →
   Human Approval.
2. The **specialists execute in sequence**, each status flipping
   live in the left "Agent Swarm" sidebar. Every artifact lands in the center
   workspace as it's produced — script as text, storyboard as scene descriptions,
   visuals as stills, clips as video, narration as audio, captions as on-screen
   text.
3. The **Critic/QA** agent reviews the composed video and returns
   `APPROVED` or `NEEDS_REVISION` with actionable notes.
4. The **Human Veto** gate fires: the pipeline pauses, an approval modal opens
   in-page, and the human decides.
   - **Approve** → campaign complete, export enabled.
   - **Reject** → pick the offending scene, type a note (*"doesn't feel
     premium — elevate the product hero shot"*), click **Remake Scene 3**. Only
     that scene regenerates; the script, the other scenes, the captions, and the
     voice are untouched.

It's a production system with multiple drivers, all acting on the same state and
the same human gate:

- **In-app Director** — fill in the brief, click Run Studio. Zero API keys,
  fully deterministic demo mode.
- **Browser agent over WebMCP** — all 16 tools registered on
  `document.modelContext`; any agent can inspect and invoke them.
- **Server-side agent over HTTP** — `GET /api/webmcp/tools` for the catalog,
  `POST /api/webmcp/execute` to invoke, with state persisted across requests.

All three paths log to one Debug Panel, so there is one unified trace no matter
who is actually calling the tools.

---

## How we built it

### The spine: one store, three front doors

The non-negotiable architecture decision was **state coherence**. If the in-app
Director and an external agent could diverge, the whole "one studio, many
drivers" story collapses. So every tool is a small factory that reads and writes
the *same* Zustand store the UI renders (`src/lib/webmcp/tools/`, one file per
tool). The browser registers those tools on `modelContext`; the HTTP routes
invoke the same factories; the UI polls the server snapshot and hydrates. There
is one state, three front doors.

### Reading the spec, not the summary

WebMCP is young and the implementation details churn. Three gotchas we learned
by reading `webmachinelearning/webmcp/index.bs` directly rather than trusting
secondhand docs:

- **`document.modelContext`, not `navigator.modelContext`.** The spec defines
  it on `Document`. Chrome's origin trial shipped it on `navigator` in 149 and
  moved it to `document` in 150. `useWebMCP.ts` prefers `document` and falls
  back to `navigator`, so the studio survives the transition.
- **`registerTool()` is synchronous and throws.** Its IDL return type is
  `undefined`; it throws `InvalidStateError` (duplicate/empty name) or
  `NotAllowedError` (permissions policy) *synchronously*. So registration is
  wrapped in try/catch, not `.catch()`.
- **Tool results use the MCP content-block shape.**
  `{ content: [{ type: "text", text: "..." }] }` — a shared `textResult()`
  helper keeps every tool consistent with the Model Context Protocol format
  WebMCP deliberately mirrors.

### The human veto as a first-class tool

`request_human_approval` is the one tool every path *must* call before
completion. It implements WebMCP's confirmation pattern
(`client.requestUserInteraction`) so execution genuinely pauses until the human
decides — whether the driver is the in-app Director or an external agent. On
reject, `refine_scene` re-generates only the affected asset. The server-side
state machine refuses to transition to `phase=complete` without an explicit
human `approved: true`. No agent can ship around the human.

### Demo-first, keys-later

We built the studio to run **end-to-end with zero API keys**. Every
`/api/generate/*` route checks for a provider key; when absent it returns a
deterministic placeholder asset. Real providers (OpenAI `gpt-image-1`,
Speechify, Google Veo 3, fal.ai, Runway, Luma, Replicate) are wired and
configurable, but the default experience — the one judges hit — works with no
signup, no billing, no black box.

### Verification as a product

We shipped a hardware-style verification harness (`scripts/verify/build-mode.sh`):
6 gates, 39 acceptance tests, 3 strategic pauses, driving real Chrome to
exercise the WebMCP registration, the veto loop, and external-agent→UI
hydration. Every claim in the README is something a script actually does, not
something we assert.

---

## Challenges we ran into

### The moving WebMCP target

The API surface changed *during* the hackathon: Chrome 149 exposed
`navigator.modelContext`, Chrome 150 moved it to `document.modelContext` to
match the spec. Code written against blog posts would have broken on exactly the
wrong day. The fix was to stop trusting summaries, read `index.bs`, and support
both namespaces with a fallback chain. It taught me that for a brand-new
platform API, the spec source is the true documentation.

### Trackpad swipes that "did dead nothing"

Swipe-to-change-tab on the workspace felt dead on trackpads. The root cause
was subtle: the browser assumes every horizontal pan could be a scroll and fires
`pointercancel` to steal the gesture — dropping the swipe before it ever crossed
our 60px threshold. The fix had two parts: `touch-action: pan-y` on the panel
(telling the browser only vertical pans belong to it) and *committing the tab
change live* the instant the threshold is crossed, so a late `pointercancel`
can't eat a completed swipe.

### A stray `Esc` could fire a human veto

The rejection modal's `Esc` handler accidentally shortcut the rejection — one
stray keypress would drop the user straight into the remake loop, which is a
disaster for a flow whose entire point is that rejection is *deliberate*. We
made `Esc` toggle a two-step Reject confirm (with a reason field); a second
`Esc` cancels. Reject never resolves a decision on its own.

### "It worked yesterday" — the leftover-state problem

Server state persisted in `.studio-state.json`, and the UI persisted split
settings in `localStorage`. Fine during development, terrible for a judge demo:
a fresh visitor could load straight into someone else's finished project. We made
startup a blank session — remove localStorage persistence so prior demo state is
gone until a judge initiates — and the reset endpoint (`DELETE
/api/webmcp/execute`) idempotent.

### Serverless is not a laptop

File-based state and `public/assets/` writing are fine in `next dev` and break
on cold-start serverless. For the Vercel deploy we added a durable
Supabase-backed state path and Cloudflare R2 for generated media, with graceful
fallbacks when config is absent. Same lesson as the swipes: the demo path must
be the deploy path.

### Shipping a "finished" video without burning money

Real generation costs real money, and a judge demo shouldn't rack up a provider
bill. We added a global content cache + stills-default strategy and a
cache-first guard for image-to-video so repeated scenes reuse assets, keeping
demo cost bounded while still showing real generation paths. And when `ffmpeg`
isn't available on the host, compose falls back to a scene-manifest slideshow the
preview plays in-browser — the pipeline never dead-ends on a missing binary.

---

## Accomplishments that we're proud of

- **A genuine human veto, not a fake one.** The state machine physically cannot
  complete without `approved: true`, and rejection triggers a *targeted* remake.
  This is the difference between a generator and a studio.
- **One studio, three drivers, one trace.** The same 16 tools power the in-app
  Director, a browser agent via `document.modelContext`, and an external agent
  over HTTP — all visible in one Debug Panel and one Zustand store.
- **It runs with zero keys.** A judge can `npm install`, run the studio, run the
  whole pipeline, and download an MP4 without creating a single account.
- **Spec-verified WebMCP.** Every registration choice is checked against the W3C
  source, including the `document`/`navigator` transition and the synchronous
  throw semantics of `registerTool()`.
- **64/64 acceptance checks green** across the build-mode harness (6 gates, 39
  tests, 3 pauses) — WebMCP regression, veto loop, and external-agent hydration
  all end-to-end against real Chrome.

---

## What we learned

**WebMCP's real power is that a site declares its actions.** The coordination
problem agents used to solve by scraping and clicking is replaced by a typed,
described, owner-labeled tool surface. Once I saw the studio as "a set of
structured actions," the UI became just one more client of that surface — and
every other agent became a first-class user too.

**The human gate is the feature.** Early on I treated the veto as a compliance
checkbox. It turned out to be the emotional core of the demo: "I interrupted
mid-production, the crew adapted, and the final cut is mine." Trust in AI
creative tools comes from the ability to say *no* and be heard on *one specific
decision* — not from burning the whole roll.

**Crew size is a design decision.** One agent is a black box; fifty agents is
theatre. Ten — a Director plus nine specialists with narrow, non-overlapping
"you do NOT do X" boundaries — is legible in a sidebar, true to how a real
production house staffs a 30-second spot, and small enough to verify.

**Demo-first forces product discipline.** Every provider needed a fallback, so
the whole app had to be cohesive to run with zero keys. That constraint made the
architecture better, not worse.

And the math that steered the design — why targeted re-make beats re-rolling:

$$ E[\text{re-rolls to first acceptable video}] = \frac{1}{p_{\text{ok}}} $$

If any of $n$ scenes fails QA with probability $q=1-p$, a full re-roll needs on
average $\frac{1}{(1-q)^n}$ attempts, while a targeted re-make needs only
$\frac{1}{1-q}$. The advantage grows multiplicatively with scene count:

$$ \frac{E_{\text{full}}}{E_{\text{targeted}}} = \frac{1}{(1-q)^{n-1}}
= (1-q)^{1-n} \;\; \xrightarrow[n \to \infty]{} \infty $$

That's the whole product thesis in one equation.

---

## What's next

- **Durable multi-tenant state.** Swap the single-file store for a
  Postgres/Redis-backed server store keyed by project, so the studio becomes a
  real SaaS surface with per-tenant auth.
- **Parallel scene production.** Where steps are independent (scene visuals,
  voice, captions), dispatch them concurrently with cost/quality telemetry.
- **Refinement memory.** Carry brand guidelines and rejection notes across
  campaigns so the crew gets better at a brand over time, instead of starting
  from zero each brief.
- **Provider cost guardrails.** A per-campaign budget model with live spend
  telemetry, so the Director self-limits based on the brief's risk class.
- **A WebMCP-native "agent time" UI** — a view where the human reviews and
  comments on the crew's decisions *while they run*, not only at the gate.

---

## Built With

