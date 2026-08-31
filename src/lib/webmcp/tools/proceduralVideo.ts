// WebMCP tool — `procedural_video`.
//
// Browser-only fallback for image-to-video when no external provider
// is reachable (Veo quota, FAL/Luma/Runway keys missing). Generates
// a real WebM file from the scene's still image using Canvas +
// MediaRecorder, uploads it to /public/assets/, and stores the public
// URL on scene.videoUrl.
//
// This is the path the user's "Why VEO model not generating videos in
// each scene just images" complaint maps to. After Veo 429s and no
// FAL/Luma/Runway key is set, this tool ships a real video file.

import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { defineTool } from "@/lib/webmcp/defineTool";
import { textResult } from "@/lib/webmcp/toolResult";
import {
  generateAndUploadProceduralVideo,
  type ProceduralVideoOptions,
} from "@/lib/proceduralVideo";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = {
  sceneId: string;
  pattern?: ProceduralVideoOptions["pattern"];
  /** When true, also log to activity feed + set agent status. */
  logToActivity?: boolean;
};

export function proceduralVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "procedural_video",
    title: "Generate procedural video",
    description:
      "Generates a real video file from a scene's still image by animating it with Ken Burns / parallax / pulse / glide / tilt-shift transforms and recording the result via MediaRecorder. Browser-only fallback used when external video providers (Veo, FAL, Luma, Runway, Replicate) are not reachable. Uploads the WebM to /public/assets/ and stores the public URL on scene.videoUrl so the scene plays as a real video, not a static image.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: {
          type: "string",
          description: "ID of the scene to generate procedural video for. Must already have an imageUrl.",
        },
        pattern: {
          type: "string",
          enum: ["kenBurns-in", "kenBurns-out", "parallax-drift", "glide-up", "pulse-zoom"],
          description: "Ken Burns pattern. Default 'kenBurns-in'.",
        },
        logToActivity: {
          type: "boolean",
          description: "When true, log this call to the activity feed and update the motion-graphics agent status.",
        },
      },
      required: ["sceneId"],
    },
    execute: async ({ sceneId, pattern, logToActivity }) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) {
        throw new Error(`No scene with id "${sceneId}".`);
      }
      if (!scene.imageUrl) {
        throw new Error(`Scene ${scene.index} has no key visual. Call generate_image first.`);
      }
      if (typeof window === "undefined") {
        throw new Error(
          "procedural_video must run in the browser (uses MediaRecorder). The server-side orchestrator cannot generate procedural video — call this from a client-side tool or via the inspector's 'Make motion' button."
        );
      }

      if (logToActivity) {
        store.setAgentStatus("motion-graphics", "active", `Generating procedural video for scene ${scene.index}…`);
      }

      const result = await generateAndUploadProceduralVideo(scene, pattern);

      // Persist the new videoUrl + provider + cost on the scene.
      const patch = {
        videoUrl: result.url,
        durationSeconds: scene.durationSeconds ?? Math.round(result.duration),
        videoProvider: "procedural",
        videoLatencyMs: 0,
        videoCostUsd: 0,
      };
      store.updateScene(sceneId, patch);
      if (logToActivity) {
        store.setAgentStatus(
          "motion-graphics",
          "completed",
          `Procedural video ready for scene ${scene.index} (${(result.sizeBytes / 1024).toFixed(1)} KB).`,
        );
      }
      const r = textResult(
        `Procedural video generated for scene ${scene.index} via browser-side Ken Burns + MediaRecorder (${(result.sizeBytes / 1024).toFixed(1)} KB).`,
      );
      (r as { _meta?: unknown })._meta = {
        provider: "procedural",
        costUsd: 0,
        latencyMs: 0,
      };
      return r;
    },
  });
}
