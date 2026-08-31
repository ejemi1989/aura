import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { sceneId: string; durationSeconds?: number; motionNotes?: string };

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

export function textToVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "text_to_video",
    title: "Generate video from text",
    description:
      "Motion Graphics agent: generates a short video clip for a scene from a text prompt.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        durationSeconds: { type: "number", description: "Target clip length in seconds (2–10)." },
        motionNotes: { type: "string" },
      },
      required: ["sceneId", "durationSeconds"],
    },
    execute: async ({ sceneId, durationSeconds, motionNotes }, options) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) return textResult(`No scene with id "${sceneId}".`);
      const duration = Math.max(2, Math.min(30, Number(durationSeconds)));
      try {
        const data = await callGenerate(
          "/api/generate/text-to-video",
          {
            prompt: `${scene.description}${motionNotes ? ` — ${motionNotes}` : ""}`,
            durationSeconds: duration,
          },
          options.signal
        );
        const videoUrl = data.url === "__no_video__" ? "" : data.url;
        store.updateScene(sceneId, { videoUrl, durationSeconds: duration });
        store.setAgentStatus("motion-graphics", "active", `Generated ${duration}s clip for scene ${scene.index}.`);
        return textResult(`Generated ${duration}s clip for scene ${scene.index}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setAgentStatus("motion-graphics", "error", `Text-to-video failed: ${message}`);
        return textResult(`Text-to-video failed: ${message}`);
      }
    },
  });
}
