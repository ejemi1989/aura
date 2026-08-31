// Server-side tool catalog for external WebMCP-aware agents.
//
// When a browser agent (Chrome 149+, or any other WebMCP-capable agent
// running in the user's browser) loads the studio, it picks up the tools
// directly from `document.modelContext.registerTool`. No HTTP roundtrip
// needed — that's the point of the spec.
//
// But some agents run outside the browser (server-side orchestration,
// CI pipelines, programmatic integration from a partner's backend) and
// need to discover and invoke the same tools over HTTP. This module is
// the public, versioned shape those integrations consume.
//
// IMPORTANT: This catalog MUST stay in sync with src/lib/webmcp/tools/.
// The buildAllTools() factory in the browser is the source of truth for
// the in-app agent; the descriptions and input schemas here mirror what
// that factory exposes, so an external agent and the in-app Director
// see one identical contract.

export interface WebMCPHttpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}

export const WEB_MCP_HTTP_TOOLS: WebMCPHttpTool[] = [
  {
    name: "create_project",
    title: "Create project",
    description:
      "Starts a new video campaign in the studio. Sets the campaign name, goal, target audience, " +
      "platform, and visual style. Call this once at the very start of a new campaign, before any " +
      "other studio tool.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, human-readable campaign name." },
        goal: { type: "string", description: "What this video should accomplish, in plain language." },
        audience: { type: "string", description: "Who the video is for." },
        platform: { type: "string", enum: ["instagram", "youtube", "tiktok", "linkedin", "generic"] },
        style: { type: "string", enum: ["professional", "casual", "dramatic", "playful", "cinematic"] },
        targetDurationSeconds: { type: "number" },
      },
      required: ["name", "goal", "audience", "platform", "style"],
    },
  },
  {
    name: "generate_script",
    title: "Generate script",
    description:
      "Scriptwriter agent: writes a scene-by-scene video script and narration lines from the " +
      "project's brief and brand guidelines.",
    inputSchema: {
      type: "object",
      properties: {
        sceneCount: { type: "number", description: "How many scenes the script should have." },
        keyMessage: { type: "string", description: "The single most important idea the script must land." },
      },
      required: ["sceneCount", "keyMessage"],
    },
  },
  {
    name: "create_storyboard",
    title: "Create storyboard",
    description:
      "Graphic Designer agent: turns the existing script scenes into a storyboard by writing a " +
      "concrete image-generation prompt for each scene.",
    inputSchema: {
      type: "object",
      properties: {
        visualStyleNotes: { type: "string", description: "Art-direction notes to apply across every scene." },
      },
      required: ["visualStyleNotes"],
    },
  },
  {
    name: "generate_image",
    title: "Generate key visual",
    description:
      "Graphic Designer agent: generates the still key visual for one scene from its storyboard prompt.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        promptOverride: { type: "string" },
      },
      required: ["sceneId"],
    },
  },
  {
    name: "text_to_video",
    title: "Generate video from text",
    description: "Motion Graphics agent: generates a short video clip for a scene from a text prompt.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        durationSeconds: { type: "number" },
        motionNotes: { type: "string" },
      },
      required: ["sceneId", "durationSeconds"],
    },
  },
  {
    name: "refine_scene",
    title: "Refine scene",
    description:
      "Refines an existing scene from specific feedback and/or a list of property/value changes " +
      "(description, imagePrompt, caption, durationSeconds). Used after Critic/QA returns " +
      "NEEDS_REVISION, or for a targeted human edit. Re-generates the scene's key visual when " +
      "feedback is provided and a visual already exists.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        feedback: { type: "string" },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              property: { type: "string" },
              value: { type: "string" },
            },
          },
        },
      },
      required: ["sceneId"],
    },
  },
  {
    name: "image_to_video",
    title: "Animate key visual",
    description: "Motion Graphics agent: animates an existing scene key visual into a short video clip.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        durationSeconds: { type: "number" },
        motionNotes: { type: "string" },
      },
      required: ["sceneId", "durationSeconds"],
    },
  },
  {
    name: "text_to_speech",
    title: "Generate narration",
    description: "Voiceover agent: converts a scene's narration line into spoken audio.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        line: { type: "string" },
        voiceTone: { type: "string", enum: ["warm", "energetic", "authoritative", "calm", "playful"] },
      },
      required: ["sceneId", "line", "voiceTone"],
    },
  },
  {
    name: "write_caption",
    title: "Write caption",
    description: "Copywriter agent: writes short-form on-screen text or a social caption for one scene.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        purpose: { type: "string", enum: ["on_screen_text", "post_caption", "hook_line"] },
      },
      required: ["sceneId", "purpose"],
    },
  },
  {
    name: "compose_video",
    title: "Compose final video",
    description: "Video Editor agent: assembles all scene clips, narration, and captions into a single timeline.",
    inputSchema: {
      type: "object",
      properties: {
        transitionStyle: { type: "string", enum: ["cut", "crossfade", "whip_pan", "match_cut"] },
      },
      required: ["transitionStyle"],
    },
  },
  {
    name: "review_video",
    title: "Review composed video",
    description: "Critic/QA agent: reviews the composed video and returns APPROVED or NEEDS_REVISION.",
    inputSchema: {
      type: "object",
      properties: {
        checklistNotes: { type: "string" },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "request_human_approval",
    title: "Request human approval",
    description:
      "Pauses the campaign and asks the human to approve or reject before proceeding.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        detail: { type: "string" },
      },
      required: ["summary", "detail"],
    },
  },
  {
    name: "get_project_status",
    title: "Get project status",
    description: "Project Manager agent: returns a snapshot of the current project state.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_project_roadmap",
    title: "Get project roadmap",
    description: "Project Manager agent: returns the full production roadmap.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "export_video",
    title: "Export composed video",
    description:
      "Video Editor agent: confirms the composed video is ready to ship " +
      "and reports what export would produce. With download=true an agent " +
      "running in the browser triggers the actual file download. Without " +
      "a real mp4 on disk the studio falls back to a per-scene slideshow " +
      "manifest that the VideoPreview component stitches in-browser.",
    inputSchema: {
      type: "object",
      properties: {
        download: { type: "boolean", description: "When true (browser-side only), trigger the actual file download." },
      },
    },
  },
  {
    name: "list_available_providers",
    title: "List configured providers",
    description:
      "Returns which generation providers are configured for each " +
      "capability (image, tts, text-to-video, image-to-video, compose). " +
      "Lets an external agent see whether the studio will call real " +
      "APIs (OpenAI, Google Veo, Speechify, etc.) or fall back to " +
      "deterministic placeholders under DEMO_MODE. Read-only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];
