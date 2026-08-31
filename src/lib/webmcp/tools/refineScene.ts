import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;

/**
 * A "change" is a named property/value pair to apply onto a scene. We only
 * allow the scene fields that a specialist may actually touch when
 * regenerating/refining a frame — free-form patch objects would let an agent
 * corrupt the store. Everything else is rejected up front.
 */
const EDITABLE_SCENE_FIELDS = new Set([
  "description",
  "imagePrompt",
  "caption",
  "durationSeconds",
]);

type Input = {
  sceneId: string;
  feedback?: string;
  changes?: { property: string; value: string }[];
};

/**
 * Spec Tool 13 — `refine_scene`: refine an existing scene based on specific
 * feedback and changes. This is the re-generation loop the Creative Director
 * uses after the Critic/QA agent returns NEEDS_REVISION for a particular
 * scene. It applies the listed property/property edits onto the scene and, if
 * the scene already has a key visual, re-runs image generation against the
 * feedback so the change is observable in the Program Monitor.
 */
export function refineSceneTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "refine_scene",
    title: "Refine scene",
    description:
      "Refines an existing scene from specific feedback and/or a list of property/value " +
      "changes. Applied from the Critic/QA NEEDS_REVISION loop, or from a human asking for a " +
      "targeted edit. Pass sceneId plus optional feedback (why it needs work) and a changes " +
      "array covering one or more of: description, imagePrompt, caption, durationSeconds. " +
      "When the scene has a key visual, the still is re-generated against the feedback.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string", description: "The scene id, e.g. \"scene_2\"." },
        feedback: { type: "string", description: "Why the scene needs refinement — this drives re-generation." },
        changes: {
          type: "array",
          description: "Specific property/value edits to apply to the scene.",
          items: {
            type: "object",
            properties: {
              property: { type: "string", description: "One of: description, imagePrompt, caption, durationSeconds." },
              value: { type: "string", description: "The new value." },
            },
          },
        },
      },
      required: ["sceneId"],
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false,
    },
    execute: async ({ sceneId, feedback, changes }, options) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) {
        return textResult(`No scene with id "${sceneId}".`);
      }

      const summary: string[] = [];
      const patch: Record<string, unknown> = {};

      for (const change of changes ?? []) {
        const property = change?.property;
        if (!property || !EDITABLE_SCENE_FIELDS.has(property)) {
          return textResult(
            `Refine failed: "${property ?? "(missing)"}" is not an editable scene field. ` +
              `Use one of: ${[...EDITABLE_SCENE_FIELDS].join(", ")}.`
          );
        }
        const value = change.value;
        patch[property] = property === "durationSeconds" ? Number(value) || undefined : value;
        summary.push(`${property} → "${value}"`);
      }

      // Apply the edits first so the scene reflects the human's intent even
      // if the visual re-generation below fails.
      const regenerated: ("image" | "video" | "voiceover" | "caption" | "script")[] = [];
      if (patch && Object.keys(patch).length > 0) {
        if ("caption" in patch) regenerated.push("caption");
        if ("imagePrompt" in patch || "description" in patch) regenerated.push("image");
      }
      store.updateScene(sceneId, patch);

      let regeneratedProvider: string | undefined;
      let regeneratedLatencyMs: number | undefined;
      if (feedback) {
        store.setAgentStatus("graphic-designer", "active", `Refining scene ${scene.index} from feedback.`);
        const t0 = Date.now();
        try {
          const res = await fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: feedback,
              size: "1536x1024",
            }),
            signal: options.signal,
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.url) {
            regeneratedLatencyMs = Date.now() - t0;
            regeneratedProvider = data.provider ?? "demo";
            store.updateScene(sceneId, {
              imageUrl: data.url,
              imagePrompt: feedback,
              imageProvider: regeneratedProvider,
              imageLatencyMs: regeneratedLatencyMs,
            });
            regenerated.push("image");
            summary.push("key visual re-generated");
          } else {
            summary.push("key visual left unchanged (re-generation failed)");
          }
        } catch (err) {
          summary.push("key visual left unchanged (re-generation failed)");
        }
      }

      // Preserve everything else: script, composition, anything on the
      // scene that wasn't touched by this refine.
      const after = store.project.scenes.find((s) => s.id === sceneId);
      const preserved: ("script" | "image" | "video" | "voiceover" | "caption" | "composition")[] = [
        "script",
        "composition",
      ];
      if (after?.imageUrl && !regenerated.includes("image")) preserved.push("image");
      if (after?.videoUrl) preserved.push("video");
      if (after?.voiceoverUrl) preserved.push("voiceover");
      if (after?.caption && !regenerated.includes("caption")) preserved.push("caption");

      // Record the diff on the project so the UI can show "what changed"
      // after a Reject → Remake loop. Cleared on the next campaign complete.
      store.setProjectMeta({
        revisionDiff: {
          sceneId,
          sceneIndex: scene.index,
          feedback,
          regenerated,
          preserved,
          provider: regeneratedProvider,
          latencyMs: regeneratedLatencyMs,
          createdAt: Date.now(),
        },
      });

      store.setPhase("assets");
      if (summary.length === 0) {
        return textResult(`Scene ${scene.index} unchanged — pass a non-empty 'changes' or 'feedback'.`);
      }
      store.setAgentStatus("graphic-designer", "completed", `Refined scene ${scene.index}: ${summary.join(", ")}`);
      const result: any = textResult(`Refined scene ${scene.index}: ${summary.join(", ")}.`);
      result._meta = {
        provider: regeneratedProvider ?? "studio",
        costUsd: 0,
        latencyMs: regeneratedLatencyMs ?? 0,
      };
      return result;
    },
  });
}
