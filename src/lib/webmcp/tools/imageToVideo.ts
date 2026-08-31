import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { threadArtifactToSupabase, threadToolRun } from "@/lib/supabase/threading";
import { upsertScene } from "@/lib/supabase/writers";

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

export function imageToVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "image_to_video",
    title: "Animate key visual",
    description:
      "Motion Graphics agent: animates an existing scene key visual into a short video clip.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        durationSeconds: { type: "number", description: "Target clip length in seconds (2–10)." },
        motionNotes: { type: "string", description: "Camera/motion direction, e.g. 'slow push in, parallax'." },
      },
      required: ["sceneId", "durationSeconds"],
    },
    execute: async ({ sceneId, durationSeconds, motionNotes }, options) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) return textResult(`No scene with id "${sceneId}".`);
      if (!scene.imageUrl) {
        return textResult(`Scene ${scene.index} has no key visual yet. Call generate_image first.`);
      }
      const duration = Math.max(2, Math.min(30, Number(durationSeconds)));
      const t0 = Date.now();
      const supabaseProjectId = store.project.supabaseProjectId;
      const supabaseSceneId = supabaseProjectId
        ? await upsertScene({
            projectId: supabaseProjectId,
            sceneNumber: scene.index,
            prompt: scene.description ?? "",
            status: "motion_pending",
            duration,
          })
        : null;
      try {
        const data = await callGenerate(
          "/api/generate/image-to-video",
          {
            imageUrl: scene.imageUrl,
            prompt: scene.description,
            motionNotes,
            durationSeconds: duration,
          },
          options.signal
        );
        const latencyMs = Date.now() - t0;
        // Demo fallback (no ffmpeg) substitutes the key visual as the "video".
        const videoUrl = data.url === "__no_video__" ? scene.imageUrl : data.url;
        const provider: string = data.provider ?? "demo";
        const costUsd =
          provider === "google"
            ? Math.round(duration * 0.35 * 1000) / 1000 // ~$0.35/sec on Veo 3 (high quality)
            : provider === "runway"
              ? Math.round(duration * 0.12 * 1000) / 1000
              : 0;
        store.updateScene(sceneId, {
          videoUrl,
          durationSeconds: duration,
          videoProvider: provider,
          videoLatencyMs: latencyMs,
          videoCostUsd: costUsd,
        });
        // Skip the artifact write-through for the demo fallback (URL === imageUrl
        // already persisted by generate_image). Only the real provider output
        // gets a new video artifact row.
        if (videoUrl !== scene.imageUrl) {
          await threadArtifactToSupabase({
            url: videoUrl,
            projectSupabaseId: supabaseProjectId,
            sceneSupabaseId: supabaseSceneId,
            type: "video",
            mimeType: "video/mp4",
            provider,
            cacheInput: {
              tool: "video",
              projectName: store.project.name,
              sceneNumber: scene.index,
              prompt: scene.description,
              model: data.model,
              duration,
              motionNotes,
              inputArtifact: scene.imageUrl,
            },
            metadata: {
              cost_usd: costUsd,
              latency_ms: latencyMs,
              duration_seconds: duration,
              source_image: scene.imageUrl,
            },
          });
        }
        await threadToolRun({
          projectSupabaseId: supabaseProjectId,
          sceneSupabaseId: supabaseSceneId,
          toolName: "image_to_video",
          agent: "motion-graphics",
          status: "success",
          input: { sceneId, imageUrl: scene.imageUrl, prompt: scene.description, motionNotes, duration },
          output: { url: videoUrl, provider, duration },
        });
        store.setAgentStatus(
          "motion-graphics",
          "active",
          `Animated scene ${scene.index} into a ${duration}s clip via ${provider}${costUsd ? ` ($${costUsd.toFixed(3)})` : ""}.`
        );
        const result: any = textResult(`Animated scene ${scene.index}.`);
        result._meta = { provider, costUsd, latencyMs };
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setAgentStatus("motion-graphics", "error", `Image-to-video failed: ${message}`);
        await threadToolRun({
          projectSupabaseId: supabaseProjectId,
          sceneSupabaseId: supabaseSceneId,
          toolName: "image_to_video",
          agent: "motion-graphics",
          status: "error",
          input: { sceneId, imageUrl: scene.imageUrl, duration },
          error: message,
        });
        return textResult(`Image-to-video failed: ${message}`);
      }
    },
  });
}
