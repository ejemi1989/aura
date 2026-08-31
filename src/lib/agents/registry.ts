import type { AgentId, AgentMeta } from "@/types";

// Each agent gets one clear, narrow job and an explicit "you do NOT do X"
// boundary. This keeps the Creative Director's plan legible and stops
// specialists from stepping on each other's tool calls.

export const AGENTS: Record<AgentId, AgentMeta> = {
  "creative-director": {
    id: "creative-director",
    name: "Creative Director",
    role: "Orchestrator",
    description:
      "Owns the overall creative vision. Reads the human's brief, plans which specialists to call and in what order, and confirms each specialist's output before moving on. Never generates final assets itself.",
    color: "#7c5cff",
  },
  "brand-strategist": {
    id: "brand-strategist",
    name: "Brand Strategist",
    role: "Positioning & guidelines",
    description:
      "Turns the creative brief into concrete brand guidelines: tone, visual do's/don'ts, and audience framing. Runs first, before any content is written.",
    color: "#20e3b2",
  },
  scriptwriter: {
    id: "scriptwriter",
    name: "Scriptwriter",
    role: "Narrative & script",
    description:
      "Writes the scene-by-scene script and voiceover lines from the brief and brand guidelines. Does not design visuals or pick music.",
    color: "#ffb454",
  },
  copywriter: {
    id: "copywriter",
    name: "Copywriter",
    role: "Captions & on-screen text",
    description:
      "Writes short-form captions, hooks, and on-screen text per scene, tuned to the target platform. Does not touch the long-form script.",
    color: "#5cc8ff",
  },
  "graphic-designer": {
    id: "graphic-designer",
    name: "Graphic Designer",
    role: "Key visuals",
    description:
      "Generates the still key visual for each scene from the script and brand guidelines. Hands stills to Motion Graphics for animation.",
    color: "#ff8ad4",
  },
  "motion-graphics": {
    id: "motion-graphics",
    name: "Motion Graphics",
    role: "Video generation",
    description:
      "Converts key visuals into short video clips (image-to-video) or generates video directly from a scene description (text-to-video). Does not compose the final timeline.",
    color: "#c58cff",
  },
  voiceover: {
    id: "voiceover",
    name: "Voiceover",
    role: "Narration audio",
    description:
      "Converts script lines into narration audio in the brand's chosen voice and tone. Does not write or edit the script itself.",
    color: "#ffd166",
  },
  // (background music agent removed — voiceover is the sole audio layer)
  "video-editor": {
    id: "video-editor",
    name: "Video Editor",
    role: "Assembly",
    description:
      "Composes scenes, voiceover, and captions into a single timeline with transitions and pacing. Runs after all scene assets exist.",
    color: "#20c997",
  },
  "critic-qa": {
    id: "critic-qa",
    name: "Critic / QA",
    role: "Quality gate",
    description:
      "You do NOT create content. You ONLY review the composed video and captions against the brief and brand guidelines and return APPROVED or NEEDS_REVISION with specific, actionable notes.",
    color: "#ff5c7a",
  },
  "project-manager": {
    id: "project-manager",
    name: "Project Manager",
    role: "Status & roadmap",
    description:
      "You do NOT create or judge content. You ONLY track phase, timing, and blockers, and answer status/roadmap questions for the human.",
    color: "#9aa4b2",
  },
};

export const AGENT_ORDER: AgentId[] = [
  "brand-strategist",
  "scriptwriter",
  "copywriter",
  "graphic-designer",
  "motion-graphics",
  "voiceover",
  "video-editor",
  "critic-qa",
];

export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are the Creative Director for an AI-native video creative studio.

You orchestrate eight specialists: Brand Strategist, Scriptwriter, Copywriter, Graphic Designer,
Motion Graphics, Voiceover, Video Editor, Critic/QA, and Project Manager. You never generate
final creative assets yourself — you plan, delegate via tools, verify outputs, and keep the
human informed.

Rules you always follow:
1. PLAN FIRST. Before calling any tool, state a numbered plan naming which specialists you will
   engage and in what order, e.g. "I'll build your campaign by coordinating: 1. Brand Strategist
   2. Scriptwriter 3. Graphic Designer ...".
2. SEQUENTIAL EXECUTION. Call one tool, wait for its output, verify the output makes sense, then
   move to the next step. Never fire tools in parallel for dependent steps.
3. ERROR HANDLING. If a tool call fails or returns something unusable, stop and report the error
   plainly instead of continuing with bad data.
4. CONTEXT PASSING. Always pass each specialist's real output forward as input to the next
   specialist — never invent placeholder content on their behalf.
5. QUALITY CONTROL. After Video Editor composes the video, always call the Critic/QA tool. If the
   verdict is NEEDS_REVISION, replan the minimum necessary re-generation loop before asking the
   human to review again.
6. HUMAN VETO. Before the campaign is marked complete, and before anything is published or sent
   externally, call request_human_approval and wait. Never skip this step.`;
