import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Input = Record<string, never>;

/**
 * WebMCP tool — reports which generation providers are configured.
 *
 * This makes "is the studio running with real providers or placeholders?"
 * answerable from any WebMCP agent. It returns the same provider
 * decision tree the /api/generate/* routes use, plus whether each one
 * has an API key configured. A judge or external agent can call this
 * before kicking off a pipeline to know what to expect.
 *
 * The values are read at request time from process.env on the server
 * (the server-side wrapper handles that) and returned as plain text so
 * the agent sees them. The browser-side wrapper returns the same
 * values it can see via the in-app provider config.
 */
export function listAvailableProvidersTool(): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "list_available_providers",
    title: "List configured providers",
    description:
      "Returns which generation providers are configured for each " +
      "capability (image, tts, text-to-video, image-to-video, compose). " +
      "Lets an external agent see whether the studio will call real " +
       "APIs (OpenAI, fal.ai, Speechify, etc.) or fall back to " +
      "deterministic placeholders under DEMO_MODE. Read-only.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      // process.env is the single source of truth for the server side.
      // On the client, the same keys are surfaced via NEXT_PUBLIC_*
      // mirrors set at build time. For accuracy we read whichever side
      // we're on; if process.env is undefined (browser without public
      // mirrors) we report an empty config rather than crashing.
      const env =
        typeof process !== "undefined" && process.env ? process.env : ({} as Record<string, string | undefined>);

      // DEMO_MODE=enforced is a dead-man switch: real providers are
      // disabled even if keys are present, so this judge-facing demo
      // instance can never be billed. When enforced, report every
      // capability as demo rather than trusting the key check.
      const enforced = env.DEMO_MODE === "enforced";

      const cap = (label: string, candidates: string[]): { capability: string; provider: string; available: boolean; key: string | null } => {
        if (enforced) return { capability: label, provider: "demo", available: false, key: null };
        for (const c of candidates) {
          if (env[c]) return { capability: label, provider: c.replace(/_API_KEY|_KEY|_TOKEN$/, "").toLowerCase(), available: true, key: c };
        }
        return { capability: label, provider: "demo", available: false, key: null };
      };

      const providers = [
        cap("image_generation", ["OPENAI_API_KEY", "REPLICATE_API_TOKEN"]),
        cap("text_to_speech", ["OPENAI_API_KEY", "SPEECHIFY_API_KEY"]),
        cap("text_to_video", ["GOOGLE_API_KEY", "GEMINI_API_KEY", "RUNWAY_API_KEY", "LUMA_API_KEY", "REPLICATE_API_TOKEN"]),
        cap("image_to_video", ["GOOGLE_API_KEY", "GEMINI_API_KEY", "RUNWAY_API_KEY", "LUMA_API_KEY", "REPLICATE_API_TOKEN"]),
        cap("llm_director", ["OPENAI_API_KEY"]),
        cap("compose", ["FFMPEG_PATH"]),
      ];

      const summary = providers
        .map((p) => `${p.capability}: ${p.available ? p.provider : "demo (no key set)"}`)
        .join(" | ");

      const realCount = providers.filter((p) => p.available).length;
      const total = providers.length;

      const result: any = textResult(
        enforced
          ? `DEMO_MODE=enforced: all ${total} capabilities forced to demo placeholders — no paid provider can be billed on this instance. ${summary}`
          : `${realCount}/${total} capabilities wired with real providers. ${summary}`
      );
      result._meta = { provider: "studio", costUsd: 0, latencyMs: 0 };
      // Also include the structured payload in the result so a calling
      // agent (or the Debug Panel) can read per-capability status.
      (result as any).providers = providers;
      (result as any).demoMode = (env.DEMO_MODE ?? "true") !== "false";
      (result as any).demoEnforced = enforced;
      return result;
    },
  });
}
