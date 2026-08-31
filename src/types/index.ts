// ---------------------------------------------------------------------------
// Core domain types for the Creative Studio.
// Kept deliberately flat and JSON-serializable: this state is what gets
// passed between the Creative Director, the specialist agents, and the
// WebMCP tool layer, and what gets rendered in the Debug Panel.
// ---------------------------------------------------------------------------

export type AgentId =
  | "creative-director"
  | "brand-strategist"
  | "scriptwriter"
  | "copywriter"
  | "graphic-designer"
  | "motion-graphics"
  | "voiceover"
  | "video-editor"
  | "critic-qa"
  | "project-manager";

export type AgentStatus = "idle" | "planning" | "active" | "completed" | "error" | "blocked";

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  color: string;
}

export interface AgentActivityEvent {
  id: string;
  agentId: AgentId;
  status: AgentStatus;
  message: string;
  timestamp: number;
}

export type ToolCallStatus = "pending" | "success" | "error" | "awaiting_approval" | "rejected";

export interface ToolCallLogEntry {
  id: string;
  toolName: string;
  agentId: AgentId | "human" | "external-agent";
  /** Where the call came from. Used by the Debug Panel to colour-code
   *  external-agent calls (orange) so a judge can see at a glance which
   *  tools were driven by an agent vs. the in-app Director. */
  origin?: "in-app-director" | "human" | "external-agent" | "browser-agent";
  input: unknown;
  output?: unknown;
  status: ToolCallStatus;
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string;
  /** Provider name for generation tools (e.g. "openai", "fal"). Populated
   *  when the tool calls a real provider; undefined for in-memory tools. */
  provider?: string;
  /** Wall-clock latency in ms (filled in by runTool on success). */
  latencyMs?: number;
  /** Estimated cost in USD for this tool call. Rough — provider list. */
  costUsd?: number;
}

export type ProjectPhase =
  | "not_started"
  | "brand"
  | "script"
  | "storyboard"
  | "assets"
  | "voiceover"
  | "assembly"
  | "review"
  | "revision"
  | "approved"
  | "complete";

export interface Scene {
  id: string;
  index: number;
  /** Full beat text: stage direction + spoken line. Used as the rich image-generation
   *  prompt so the visual matches the brief and intent. */
  description: string;
  /** Beat type from the Scriptwriter ("Hook", "Setup", "Context", "Pain",
   *  "Promise", "Proof", "Objection", "Zoom"). Drives the motion graphics
   *  overlay's transition + lower-third eyebrow + color grade defaults. */
  beatName?: string;
  /** The exact words the narrator reads aloud. Fed into TTS and shown in the
   *  storyboard so what the audience hears matches what they see on the card.
   *  Falls back to `description` when unset (legacy state files). */
  voiceoverLine?: string;
  imagePrompt?: string;
  imageUrl?: string;
  /** Provider name used to generate imageUrl (e.g. "openai", "fal"). */
  imageProvider?: string;
  /** Latency for the image generation call in ms. */
  imageLatencyMs?: number;
  /** Estimated cost in USD for the image. */
  imageCostUsd?: number;
  videoUrl?: string;
  /** Provider name used to generate videoUrl (e.g. "fal", "demo"). */
  videoProvider?: string;
  videoLatencyMs?: number;
  videoCostUsd?: number;
  voiceoverUrl?: string;
  voiceProvider?: string;
  voiceLatencyMs?: number;
  voiceCostUsd?: number;
  /** Exact voiceover length in ms (from Speechify/OpenAI speech_marks).
   *  Drives scene slot length so audio plays to its full end without
   *  being cut mid-word. */
  voiceoverDurationMs?: number;
  caption?: string;
  durationSeconds?: number;
  /** Per-scene motion graphics overrides (set via inspector or QA revision). */
  motionPattern?: string | null;
  colorGrade?: string | null;
  particleStyle?: string | null;
  accent?: string | null;
  showWatermark?: boolean | null;
  showLowerThird?: boolean | null;
}

export interface CreativeBrief {
  goal: string;
  audience: string;
  platform: "instagram" | "youtube" | "tiktok" | "linkedin" | "generic";
  style: "professional" | "casual" | "dramatic" | "playful" | "cinematic";
  brandVoice?: string;
  targetDurationSeconds?: number;
}

export interface Project {
  id: string;
  name: string;
  brief?: CreativeBrief;
  phase: ProjectPhase;
  brandGuidelines?: string;
  script?: string;
  scenes: Scene[];
  captions: string[];
  composedVideoUrl?: string;
  composedVideoProvider?: string;
  qaNotes?: string[];
  qaVerdict?: "APPROVED" | "NEEDS_REVISION" | null;
  createdAt: number;
  updatedAt: number;
  /** Diff describing what changed during the most recent refine_scene /
   *  Reject loop, so the UI can show a "what changed" strip after a
   *  remake. Cleared on the next successful campaign complete. */
  revisionDiff?: RevisionDiff;
  /**
   * Bigint id from the Supabase `projects` row, populated by the
   * `create_project` tool when Supabase is configured. Downstream
   * tools (generate_image, text_to_speech, etc.) read this to scope
   * their own writes (`artifacts`, `tool_runs`, `generation_jobs`).
   * When Supabase isn't configured, this is undefined and the writers
   * no-op gracefully.
   */
  supabaseProjectId?: number;
}

export interface RevisionDiff {
  /** Scene id that was remade. */
  sceneId: string;
  /** Scene index (1-based) for display. */
  sceneIndex: number;
  /** Free-text feedback the human typed into the remake field. */
  feedback?: string;
  /** What was regenerated: "image", "video", "voiceover", etc. */
  regenerated: ("image" | "video" | "voiceover" | "caption" | "script")[];
  /** What was preserved (anything NOT in `regenerated`). */
  preserved: ("script" | "image" | "video" | "voiceover" | "caption" | "composition")[];
  /** Provider name used to regenerate. */
  provider?: string;
  latencyMs?: number;
  costUsd?: number;
  createdAt: number;
}

export interface PendingApproval {
  id: string;
  requestedBy: AgentId;
  summary: string;
  detail: string;
  payload?: unknown;
  createdAt: number;
  /** True when this approval was mirrored from the server-side WebMCP path
   *  (external agent) and therefore must be resolved via /api/webmcp/assert. */
  server?: boolean;
}

/**
 * A mid-run human veto. Unlike the terminal ApprovalModal, this is a
 * request to stop the pipeline and remake a specific scene while the crew
 * is still mid-production. The Director picks this up at its next
 * checkpoint, runs `refine_scene` on the scene (re-generating its key
 * visual), logs what changed, and resumes.
 */
export interface RevisionRequest {
  sceneId: string;
  sceneIndex: number;
  /** Why the human wants it remade — passed into refine_scene.feedback. */
  feedback?: string;
  status: "requested" | "applied";
  createdAt: number;
}

// ---------------------------------------------------------------------------
// WebMCP tool typing helpers.
//
// Hand-written against the spec source at
// https://github.com/webmachinelearning/webmcp/blob/main/index.bs and the
// "Imperative Tool Registration" / "Discovering and running tools" examples
// in the explainer (requirement.md). Things that are easy to get wrong:
//
// 1. The API lives on `document.modelContext` (Chrome 150+), not
//    `navigator.modelContext` (Chrome 149 origin trial). This file declares
//    and feature-detects both so the studio works across the Chrome
//    transition without a browser-sniffing branch.
//
// 2. `registerTool()` returns a `Promise<undefined>`. Per the spec, it
//    REJECTS with InvalidStateError for a duplicate/empty name, NotAllowedError
//    if the "tools" permissions-policy feature is disabled, or SecurityError
//    for non-trustworthy `exposedTo` origins. Call sites must use
//    `.then()/.catch()` (or await in try/catch), not synchronous try/catch.
//
// 3. `execute` returns `Promise<any>`. We standardize on the MCP-shaped
//    `{ content: [{ type: "text", text: string }] }` so results interop with
//    any agent that expects MCP-flavored responses; the spec allows any
//    JSON-serializable return value.
//
// 4. Tool name validation: ASCII alphanumeric + U+005F LOW LINE (_),
//    U+002D HYPHEN-MINUS (-), U+002E FULL STOP (.), length 1–128.
//
// 5. `EventTarget`-derived `ModelContext` fires a `toolchange`
//    event when tools are registered or unregistered.
// ---------------------------------------------------------------------------

export interface WebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

/**
 * The "client" object passed into a tool's `execute` callback. The
 * spec describes this as `WebMCPClient` and provides one method:
 * `requestUserInteraction`, which lets a tool pause its own execution
 * until the user takes some action (e.g. approving a modal).
 *
 * In our studio this is what `request_human_approval` uses — the agent
 * can't mark a campaign complete without a human clicking Approve.
 */
export interface WebMCPClient {
  requestUserInteraction: <T>(callback: () => Promise<T> | T) => Promise<T>;
}

/** MCP-shaped tool result, matching the Model Context Protocol. */
export interface ToolResultContent {
  type: "text";
  text: string;
}
export interface ToolResult {
  content: ToolResultContent[];
}

/** Spec IDL: `dictionary ModelContextTool`. */
export interface WebMCPTool<TInput = any> {
  name: string;
  description: string;
  title?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  /**
   * Spec IDL: `callback ToolExecuteCallback = Promise<any> (object inputObject, ToolExecuteCallbackOptions options)`.
   * First arg is the parsed input object, second is `{ signal }` for cancellation.
   */
  execute: (input: TInput, options: WebMCPExecuteOptions) => Promise<unknown> | unknown;
}

/** Spec IDL: `dictionary ModelContextRegisterToolOptions`. */
export interface WebMCPRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

/** Spec IDL: `dictionary ToolExecuteCallbackOptions`. */
export interface WebMCPExecuteOptions {
  signal: AbortSignal;
}

/** Spec IDL: `dictionary RegisteredTool` — the shape browsers hand to agents. */
export interface WebMCPRegisteredTool {
  name: string;
  title: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  /** Browser-supplied: the Window that registered this tool. */
  window: Window;
  /** Browser-supplied: the origin the tool was registered from. */
  origin: string;
}

/** Spec IDL: `dictionary ModelContextGetToolOptions`. */
export interface WebMCPGetToolOptions {
  fromOrigins?: string[];
}

  /** Spec IDL: `dictionary ModelContextExecuteToolOptions`. */
  export interface WebMCPExecuteToolOptions {
    signal?: AbortSignal;
  }

  /**
   * Spec IDL: `interface ModelContext : EventTarget`.
   * The actual browser implements this as `EventTarget`-derived with a
   * `toolchange` event; we model both the modern `addEventListener` and the
   * legacy `ontoolchange` attribute shape.
   */
  export interface WebMCPModelContext {
    registerTool: (
      tool: WebMCPTool,
      options?: WebMCPRegisterOptions
    ) => Promise<undefined>;
    getTools?: (options?: WebMCPGetToolOptions) => Promise<WebMCPRegisteredTool[]>;
    executeTool?: (
      tool: WebMCPRegisteredTool,
      // Accept both shapes the ecosystem uses today: the Chrome docs pass a
      // JSON *string* (`executeTool(tool, '{"text":"Buy milk"}')`), while the
      // spec IDL declares an `object` (`optional object inputObject = {}`).
      // The spec is still moving, so we keep this loose rather than forcing
      // callers into either convention.
      input?: unknown,
      options?: WebMCPExecuteToolOptions
    ) => Promise<string | null>;
    addEventListener?: (
      type: "toolchange",
      listener: (ev: Event) => void
    ) => void;
    removeEventListener?: (
      type: "toolchange",
      listener: (ev: Event) => void
    ) => void;
    /** Spec IDL: `attribute EventHandler ontoolchange`. */
    ontoolchange?: ((ev: Event) => void) | null;
  }

/** A custom event the browser fires when tools are added or removed. */
export interface WebMCPChangeEvent extends Event {
  // The spec doesn't currently expose any custom fields on toolchange,
  // but agents typically re-call `getTools()` in response.
}

declare global {
  interface Document {
    modelContext?: WebMCPModelContext;
  }
  interface Navigator {
    // Back-compat only: the Chrome 149 origin trial's original location
    // before the spec settled on `document.modelContext`.
    modelContext?: WebMCPModelContext;
  }
}
