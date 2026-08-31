import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import type { WebMCPTool } from "@/types";
import { buildBeats, type Platform, type Style } from "@/lib/webmcp/scriptBeats";

type Store = ReturnType<typeof import("@/lib/store/useStudioStore").useStudioStore.getState>;
type Input = { sceneCount: number; keyMessage: string };

interface BriefCtx {
  goal: string;
  audience: string;
  platform: Platform;
  style: Style;
  brandVoice?: string;
}

export function generateScriptTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "generate_script",
    title: "Generate script",
    description:
      "Scriptwriter agent: writes a beat-sheet video script (Hook → Pain → Promise → Proof → " +
      "Objection → Payoff → CTA) as concrete, spoken narration lines powered by the project brief, " +
      "platform, audience, and style. Each scene's description is a real VO line that feeds " +
      "directly into Speechify TTS. Call after brand guidelines exist and before any visual or " +
      "audio generation.",
    inputSchema: {
      type: "object",
      properties: {
        sceneCount: {
          type: "number",
          description:
            "How many scenes/beats the script should have. Short-form platforms (Instagram, TikTok) " +
            "work best at 5-7; YouTube and LinkedIn can take 8+.",
        },
        keyMessage: {
          type: "string",
          description:
            "The single most important idea the script must land (e.g. 'drive signups for an eco " +
            "walking-shoe launch'). Falls back to the project brief goal.",
        },
      },
      required: ["sceneCount", "keyMessage"],
    },
    execute: ({ sceneCount, keyMessage }, options) => {
      const n = Math.max(1, Math.min(12, Math.round(sceneCount)));
      const brief = store.project.brief;
      const ctx: BriefCtx = {
        goal: brief?.goal ?? keyMessage,
        audience: brief?.audience ?? "",
        platform: (brief?.platform as Platform) ?? "generic",
        style: (brief?.style as Style) ?? "professional",
        brandVoice: brief?.brandVoice,
      };
      const beats = buildBeats(n, ctx, keyMessage);
      // Display the actual spoken words (what the narrator reads) so the
      // Script tab matches what users hear in the voiceover. Falls back
      // to `narrative` for legacy beats without `voiceoverLine`.
      const script = beats
        .map(
          (b, i) =>
            `${b.name.toUpperCase()} — Scene ${i + 1}: ${b.voiceoverLine ?? b.narrative}`
        )
        .join("\n");
      store.setProjectMeta({ script });
      store.setScenes(
        beats.map((b, i) => ({
          id: `scene_${i + 1}`,
          index: i + 1,
          description: b.narrative,
          voiceoverLine: b.voiceoverLine ?? b.narrative,
          caption: b.caption,
          // Pre-seed a rough slot length from the spoken line so the
          // timeline + Audio Mixer look correct even before TTS lands.
          // TTS replaces this with the actual audio duration; this
          // estimator just stops the default 6s from cutting long
          // voiceovers mid-word.
          durationSeconds: Math.max(
            3,
            Math.round((b.voiceoverLine ?? b.narrative).length / 14)
          ),
        }))
      );
      store.setPhase("script");
      store.setAgentStatus(
        "scriptwriter",
        "completed",
        `Drafted a ${n}-beat script for ${ctx.platform} anchored on "${keyMessage}".`
      );
      return textResult(`Wrote a ${n}-beat ${ctx.platform} script anchored on "${keyMessage}".`);
    },
  });
}
