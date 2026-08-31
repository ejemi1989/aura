# The 10-Agent Production Crew

AURA's specialist agents are defined in `src/lib/agents/registry.ts`.
Each has a single, explicit job and a clear "you do NOT do X"
boundary — so specialists don't step on each other and the
Director's plan is legible.

The crew visible in the left sidebar is the same crew the WebMCP
tools expose: the studio is one organism, not two surfaces.

## The crew

| # | Agent | Short label | Job | "Does NOT" boundary |
| --- | --- | --- | --- | --- |
| 1 | **Creative Director** | Director | Owns the overall creative vision. Reads the human's brief, plans which specialists to call and in what order, confirms each specialist's output before moving on. | Never generates final assets itself. |
| 2 | **Brand Strategist** | Brand | Turns the creative brief into concrete brand guidelines: tone, visual do's/don'ts, audience framing. Runs first, before any content is written. | Doesn't write scripts or design visuals. |
| 3 | **Scriptwriter** | Writer | Writes the scene-by-scene script and voiceover lines from the brief and brand guidelines. | Doesn't design visuals or pick music. |
| 4 | **Copywriter** | Copy | Writes short-form captions, hooks, and on-screen text per scene, tuned to the target platform. | Doesn't touch the long-form script. |
| 5 | **Graphic Designer** | Design | Generates the still key visual for each scene from the script and brand guidelines. | Doesn't animate. Hands stills to Motion Graphics. |
| 6 | **Motion Graphics** | Motion | Converts key visuals into short video clips (image-to-video) or generates video directly from a scene description (text-to-video). | Doesn't compose the final timeline. |
| 7 | **Voiceover** | Voice | Converts script lines into narration audio in the brand's chosen voice and tone. | Doesn't write or edit the script itself. |
| 8 | **Video Editor** | Editor | Composes scenes, voiceover, and captions into a single timeline with transitions and pacing. | Runs after all scene assets exist. |
| 9 | **Critic / QA** | Critic | ONLY reviews the composed video and captions against the brief and brand guidelines and returns APPROVED or NEEDS_REVISION with specific, actionable notes. | Does NOT create content. Does NOT judge. Only reviews. |
| 10 | **Project Manager** | PM | ONLY tracks phase, timing, and blockers, and answers status/roadmap questions for the human. | Does NOT create or judge content. |

## Why 10 (and not 1, or 50)

The crew size is deliberate:

- **One agent** is a black box. The Director is one agent for the human,
  but it *only plans and delegates* — every specialist has its own
  narrow job.
- **Fifty agents** is theatre. Each agent in this list has a real,
  distinct output (script vs. caption vs. visual vs. voice vs. assembly
  vs. QA) and a non-overlapping boundary.
- **Ten agents** covers the real production roles a human agency
  assigns to a 30-second video and is small enough that every one is
  visible in the Agent Swarm sidebar without scrolling.

## How they coordinate

The Creative Director orchestrates them via a **sequential plan**
with verify-between-steps:

```
1. Brand Strategist    → brand guidelines
2. Scriptwriter        → scene-by-scene script
3. Copywriter          → captions (per scene)
4. Graphic Designer    → key visuals (per scene)
5. Motion Graphics     → video clips (per scene)
6. Voiceover           → narration (per scene)
7. Video Editor        → composed timeline
8. Critic / QA         → APPROVED / NEEDS_REVISION
9. [Human Veto]        → approval gate (always)
```

Each step's output is passed as input to the next. The Director never
fires specialists in parallel for dependent steps, never invents
placeholder content on a specialist's behalf, and never skips the
Critic or the human gate.

## What this looks like in the UI

At idle, the Agent Swarm sidebar shows all 10 agents with their short
labels and IDLE status. As the Director dispatches work, the
corresponding row flips to WORKING with a one-line activity note (e.g.
*"Generated key visual for scene 2 via demo"*). When the artifact
lands, the row flips to DONE. The Debug Panel shows every tool call
the studio has made — by the in-app Director or any external agent —
in one unified trace.

A judge can verify the crew is real (not just a UI mockup) by:

- Watching the Agent Swarm update as they run the studio.
- Driving an external tool call (`POST /api/webmcp/execute` with
  `name: "generate_image", input: { sceneId: "scene_1" }`) and
  watching the corresponding agent's row flip to WORKING.

## How this maps to WebMCP tools

Each specialist owns one or more tools. The 16-tool catalog is the
production system; the 10 agents are its operators.

| Tool | Owner |
| --- | --- |
| `create_project` | Project Manager |
| `generate_script` | Scriptwriter |
| `create_storyboard` | Graphic Designer |
| `generate_image` | Graphic Designer |
| `text_to_video` | Motion Graphics |
| `image_to_video` | Motion Graphics |
| `text_to_speech` | Voiceover |
| `write_caption` | Copywriter |
| `compose_video` | Video Editor |
| `review_video` | Critic/QA |
| `request_human_approval` | Creative Director |
| `refine_scene` | Creative Director |
| `get_project_roadmap` | Project Manager |
| `get_project_status` | Project Manager |

(The Creative Director doesn't own content-creation tools — it only
plans, delegates, and gates. That's the "you do NOT do X" boundary.)
