import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { threadArtifactToSupabase, threadToolRun } from "@/lib/supabase/threading";
import { upsertScene } from "@/lib/supabase/writers";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { sceneId: string; line: string; voiceTone: "warm" | "energetic" | "authoritative" | "calm" | "playful" };

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

export function textToSpeechTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "text_to_speech",
    title: "Generate narration",
    description:
      "Voiceover agent: converts a scene's narration line into spoken audio.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        line: { type: "string", description: "The narration line to voice." },
        voiceTone: {
          type: "string",
          enum: ["warm", "energetic", "authoritative", "calm", "playful"],
          description: "Vocal tone.",
        },
      },
      required: ["sceneId", "line", "voiceTone"],
    },
    execute: async ({ sceneId, line, voiceTone }, options) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) return textResult(`No scene with id "${sceneId}".`);
      const t0 = Date.now();
      const supabaseProjectId = store.project.supabaseProjectId;
      const supabaseSceneId = supabaseProjectId
        ? await upsertScene({
            projectId: supabaseProjectId,
            sceneNumber: scene.index,
            prompt: scene.description ?? "",
            status: "voice_pending",
            duration: scene.durationSeconds ?? 4,
          })
        : null;
      try {
        const data = await callGenerate(
          "/api/generate/text-to-speech",
          { text: line, voiceTone },
          options.signal
        );
        const latencyMs = Date.now() - t0;
        const provider: string = data.provider ?? "demo";
        // Approximate cost per narration (ballpark).
        const costUsd =
          provider === "openai"
            ? 0.015 // gpt-4o-mini-tts
            : provider === "speechify"
              ? 0.03
              : 0;
        store.updateScene(sceneId, {
          voiceoverUrl: data.url,
          voiceProvider: provider,
          voiceLatencyMs: latencyMs,
          voiceCostUsd: costUsd,
          // Sync scene slot to actual voiceover length so the audio plays
          // to its full end. Without this, scenes whose voiceover is
          // longer than the slot (default ~4-6s) get cut mid-word when
          // the rAF advances the playhead past the scene boundary.
          // Ceil so the slot is always >= audio length (round could
          // produce a 5s slot for a 5.3s clip).
          voiceoverDurationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
          durationSeconds: Math.max(
            1,
            Math.ceil((typeof data.durationMs === "number" ? data.durationMs : 4000) / 1000)
          ),
        });
        await threadArtifactToSupabase({
          url: data.url,
          projectSupabaseId: supabaseProjectId,
          sceneSupabaseId: supabaseSceneId,
          type: "audio",
          mimeType: data.mimeType ?? "audio/mpeg",
          provider,
          cacheInput: {
            tool: "tts",
            projectName: store.project.name,
            sceneNumber: scene.index,
            prompt: line,
            model: data.model ?? "simba-3.2",
            voice: data.voice ?? voiceTone,
          },
          metadata: {
            cost_usd: costUsd,
            latency_ms: latencyMs,
            duration_ms: data.durationMs,
          },
        });
        await threadToolRun({
          projectSupabaseId: supabaseProjectId,
          sceneSupabaseId: supabaseSceneId,
          toolName: "text_to_speech",
          agent: "voiceover",
          status: "success",
          input: { sceneId, line, voiceTone },
          output: { url: data.url, provider, durationMs: data.durationMs },
        });
        store.setPhase("voiceover");
        store.setAgentStatus(
          "voiceover",
          "active",
          `Recorded ${voiceTone} narration for scene ${scene.index} via ${provider}${costUsd ? ` ($${costUsd.toFixed(3)})` : ""}.`
        );
        const result: any = textResult(`Recorded ${voiceTone} narration for scene ${scene.index}.`);
        result._meta = { provider, costUsd, latencyMs };
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.setAgentStatus("voiceover", "error", `TTS failed: ${message}`);
        await threadToolRun({
          projectSupabaseId: supabaseProjectId,
          sceneSupabaseId: supabaseSceneId,
          toolName: "text_to_speech",
          agent: "voiceover",
          status: "error",
          input: { sceneId, line, voiceTone },
          error: message,
        });
        return textResult(`TTS failed: ${message}`);
      }
    },
  });
}
