import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = {
  transitionStyle?: "cut" | "crossfade" | "whip_pan" | "match_cut";
};

async function callGenerate(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<any> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).message ?? `${path} returned ${res.status}`);
  return data;
}

export function composeVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "compose_video",
    title: "Compose final video",
    description:
      "Video Editor agent: assembles all scene clips, narration, and captions into a single timeline.",
    inputSchema: {
      type: "object",
      properties: {
        transitionStyle: {
          type: "string",
          enum: ["cut", "crossfade", "whip_pan", "match_cut"],
          description: "Style of transition between scenes.",
        },
      },
      required: ["transitionStyle"],
    },
    execute: async ({ transitionStyle }, options) => {
      const scenes = store.project.scenes;
      if (scenes.length === 0) {
        return textResult("No scenes exist yet. Build the script and scene assets before composing.");
      }
      const missing = scenes.filter((s) => !s.videoUrl);
      if (missing.length > 0) {
        return textResult(
          `${missing.length} scene(s) still have no video clip. Generate those with text_to_video or image_to_video before composing.`
        );
      }
      try {
        const data = await callGenerate(
          "/api/generate/compose",
          {
            scenes: scenes.map((s) => ({
              videoUrl: s.videoUrl,
              voiceoverUrl: s.voiceoverUrl,
              caption: s.caption,
              durationSeconds: s.durationSeconds,
            })),
            transitionStyle: transitionStyle ?? "crossfade",
          },
          options.signal
        );
        if (data.url) {
          store.setProjectMeta({ composedVideoUrl: data.url });
        } else if (data.manifest) {
          store.setProjectMeta({ composedVideoUrl: "__manifest__" });
        }
        store.setPhase("assembly");
        const note = data.mode === "demo" ? " (demo manifest — install ffmpeg for real mp4)" : ` via ${data.provider}`;
        store.setAgentStatus(
          "video-editor",
          "completed",
          `Composed ${scenes.length} scenes${note}.`
        );
        return textResult(`Composed ${scenes.length} scenes with ${transitionStyle} transitions${note}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setAgentStatus("video-editor", "error", `Compose failed: ${message}`);
        return textResult(`Compose failed: ${message}`);
      }
    },
  });
}
