# Problem & Motivation

## The problem, in one paragraph

Every AI video tool today is a **black box**. A user types a prompt, a
model runs for minutes, and a finished video appears. The user has no
visibility into the dozens of creative decisions that shaped the output
— the script structure, the visual style, the pacing, the voice, the
captions — and no way to interrupt any of them. If the result is
"almost right," the only recourse is to re-roll the entire thing and
hope. For a brand team producing an Instagram Reel, that's not a
production tool; that's a slot machine.

## Why this matters

The market for short-form video is exploding (Instagram Reels, TikTok,
YouTube Shorts), and the demand for fast iteration is real. But the
creative decisions that make a video actually good are
**multi-step and interdependent**: a script depends on the brand's
tone; the storyboard depends on the script; the visuals depend on the
storyboard; the motion depends on the visuals; the voice depends on
the script and brand; the captions depend on the script and platform;
the editor assembles everything; the critic reviews it; the human
approves. No single prompt can capture that.

The people who *can* capture it — brand strategists, copywriters,
art directors, motion designers — don't have an AI tool that respects
their workflow. They get a chat box. So they either (a) ignore AI
video entirely or (b) hand-roll every asset and treat AI generation as
a stock library.

## What the existing landscape is missing

| Landscape | What it does | What's missing |
| --- | --- | --- |
| Prompt-to-video (Sora, Runway Gen, Pika, Kling) | Generates a clip from a prompt | No planning, no review, no human in the loop, no iteration on a single scene |
| Chat-based creative copilots (various) | Conversational drafting of scripts/storyboards | Produces text artifacts, not finished videos; no QA loop, no human veto, no agent-actuatable surface |
| Agent frameworks (LangChain, CrewAI, AutoGen) | Backend orchestration of LLM agents | No UI for humans to see/steer; no WebMCP surface for other agents; no production control room |
| Production pipelines (Frame.io, ffmpeg + scripts) | Assemble existing footage | Not AI-native; no agent crew |

AURA fills the gap: a **production control room** where a
multi-specialist AI crew runs an end-to-end pipeline, every decision
is visible to the human, the human can interrupt and refine a single
scene without re-rolling the whole project, and the entire studio is
exposed as WebMCP tools so any browser agent or server-side agent can
drive it.

## Who this is for

- **Brand & creative teams** producing short-form video at the pace
  social demands, who want AI to do the heavy lifting without giving
  up creative direction.
- **Accessibility users** who can't reliably drive visual creative
  tools themselves but can issue natural-language intents to a
  WebMCP-capable agent.
- **Internal brand-compliance agents** at companies that need to run
  campaigns through a controlled, auditable production pipeline with
  a human gate.

## Why "agent-native" is the right frame

This is the first creative tool that's *built to be driven by agents*,
not just humans. The studio's value is in its structure — 16 tools,
10 specialists, a human gate — and that structure is exactly what
WebMCP was designed to expose. The human UI is the visible face of an
agent-actuatable production system.
