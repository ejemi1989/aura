import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { Project, Scene, WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { upsertProject } from "@/lib/supabase/writers";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = {
  name: string;
  goal: string;
  audience: string;
  platform: "instagram" | "youtube" | "tiktok" | "linkedin" | "generic";
  style: "professional" | "casual" | "dramatic" | "playful" | "cinematic";
  targetDurationSeconds?: number;
};

interface SeedManifest {
  version: number;
  campaign: { name: string; goal: string; audience: string; platform: string; style: string; targetDurationSeconds?: number };
  brand?: string;
  script?: string;
  scenes: Scene[];
}

/**
 * When SEED_DEMO=true (env), `create_project` hydrates the studio from
 * `public/assets/seed/aura-demo/manifest.json` instead of starting from
 * scratch. This lets a deployed live URL show real Veo 3 + OpenAI
 * artifacts to judges without the live URL burning provider budget per
 * `Run Studio` click. The judge still drives the Human Veto gate and
 * can Remake a scene (which calls the real provider — only the initial
 * `create_project` is short-circuited).
 */
async function loadSeedManifest(): Promise<SeedManifest | null> {
  try {
    // Load the manifest from the served public/ path via fetch so this
    // shared client+server tool never needs node:fs / node:path (which
    // webpack forbids in the browser build). public/ is served at
    // /assets/seed/aura-demo/manifest.json in both dev and prod.
    const origin = typeof window !== "undefined" && window.location
      ? window.location.origin
      : "";
    const url = `${origin}/assets/seed/aura-demo/manifest.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as SeedManifest;
  } catch {
    return null;
  }
}

export function createProjectTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "create_project",
    title: "Create project",
    description:
      "Starts a new video campaign in the studio. Sets the campaign name, goal, target audience, " +
      "platform, and visual style. Call this once at the very start of a new campaign, before any " +
      "other studio tool. When SEED_DEMO=true (env), the studio hydrates from a pre-recorded " +
      "manifest so the deployed live URL can show real Veo 3 + OpenAI artifacts without " +
      "burning provider budget per click.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short, human-readable campaign name." },
        goal: {
          type: "string",
          description: "What this video should accomplish, in plain language.",
        },
        audience: {
          type: "string",
          description: "Who the video is for.",
        },
        platform: {
          type: "string",
          enum: ["instagram", "youtube", "tiktok", "linkedin", "generic"],
          description: "Where this video will primarily be published.",
        },
        style: {
          type: "string",
          enum: ["professional", "casual", "dramatic", "playful", "cinematic"],
          description: "Overall creative tone for the campaign.",
        },
        targetDurationSeconds: {
          type: "number",
          description: "Approximate target length of the finished video, in seconds.",
        },
      },
      required: ["name", "goal", "audience", "platform", "style"],
    },
    execute: async ({ name, goal, audience, platform, style, targetDurationSeconds }) => {
      const seedEnabled =
        process.env.SEED_DEMO === "true" || process.env.SEED_DEMO === "1";
      const seed = seedEnabled ? await loadSeedManifest() : null;

      store.resetProject();
      store.setProjectMeta({
        name,
        brief: { goal, audience, platform, style, targetDurationSeconds },
      });

      // Persist the project row to Supabase (best-effort). Returns the
      // bigint id; downstream tools use it to scope their own writes.
      const projectPrompt = `${goal} | audience=${audience} | platform=${platform} | style=${style}`;
      const projectId = await upsertProject({
        name,
        prompt: projectPrompt,
        status: seed ? "image_generation" : "planning",
      });
      if (projectId != null) {
        // Stash on the store so downstream tools (generate_image,
        // text_to_speech, etc.) can read it without re-querying.
        store.setProjectMeta({ supabaseProjectId: projectId });
      }

      if (seed && Array.isArray(seed.scenes) && seed.scenes.length > 0) {
        // Seed path: populate the project with pre-recorded scenes
        // (real Veo 3 + OpenAI artifacts committed under
        // public/assets/seed/aura-demo/). The Director skips
        // generation; the Human Veto gate still fires for the judge.
        store.setProjectMeta({ brandGuidelines: seed.brand });
        store.setProjectMeta({ script: seed.script });
        store.setScenes(seed.scenes);
        store.setPhase("assets");
        // PM's single create_project task is done once the seed lands — mark
        // it completed so the swarm doesn't show PM "working" for the whole run.
        store.setAgentStatus(
          "project-manager",
          "completed",
          `Seeded from manifest: ${seed.scenes.length} scenes pre-loaded (real Veo 3 + OpenAI).`,
        );
        const totalImageCost = seed.scenes.reduce(
          (s, sc) => s + (typeof sc.imageCostUsd === "number" ? sc.imageCostUsd : 0),
          0,
        );
        const totalVideoCost = seed.scenes.reduce(
          (s, sc) => s + (typeof sc.videoCostUsd === "number" ? sc.videoCostUsd : 0),
          0,
        );
        const totalVoiceCost = seed.scenes.reduce(
          (s, sc) => s + (typeof sc.voiceCostUsd === "number" ? sc.voiceCostUsd : 0),
          0,
        );
        const totalCost = totalImageCost + totalVideoCost + totalVoiceCost;
        const result: any = textResult(
          `Seeded "${seed.campaign.name}" with ${seed.scenes.length} pre-recorded scenes ` +
            `(real Veo 3 + OpenAI, total $${totalCost.toFixed(3)}). Director skips generation; ` +
            `Human Veto still fires.`,
        );
        result._meta = { provider: "seed", costUsd: totalCost, latencyMs: 0, projectId };
        return result;
      }

      // Normal path: empty project, Director dispatches the 9
      // specialists to generate assets (demo mode by default).
      store.setPhase("brand");
      store.setAgentStatus("project-manager", "completed", `Project "${name}" created.`);
      return textResult(
        `Created project "${name}" for ${platform} in a ${style} style. Ready for the Brand Strategist.`,
      );
    },
  });
}
