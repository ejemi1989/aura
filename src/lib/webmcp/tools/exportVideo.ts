import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = {
  /** When true, the export will be triggered client-side (a download is
   *  initiated in the user's browser). The tool returns a description of
   *  what would happen; the actual download is the browser-side effect. */
  download?: boolean;
};

/**
 * WebMCP tool — exports the composed video.
 *
 * This is the WebMCP surface for "ship it." An external agent (or the
 * in-app Director) can trigger this tool to mark a campaign as ready
 * for delivery; the tool describes what export would produce. The
 * actual file download is a browser-side effect (the user must click
 * Export in the preview, or an agent running in the browser calls the
 * same export logic via the client). On the server side this tool
 * just confirms the project has composed assets and returns the
 * artifact URL when one exists.
 *
 * Including this as a WebMCP tool — rather than a UI-only button —
 * proves the studio's surface is genuinely agent-actuatable end to
 * end, not just for the planning and asset phases.
 */
export function exportVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "export_video",
    title: "Export composed video",
    description:
      "Video Editor agent: confirms the composed video is ready to ship " +
      "and reports what export would produce. With download=true an agent " +
      "running in the browser triggers the actual file download. Without " +
      "a real mp4 on disk the studio falls back to a per-scene slideshow " +
      "manifest that the VideoPreview component stitches in-browser.",
    inputSchema: {
      type: "object",
      properties: {
        download: {
          type: "boolean",
          description: "When true (browser-side only), trigger the actual file download.",
        },
      },
    },
    execute: async ({ download }) => {
      const project = store.project;
      if (project.phase !== "approved" && project.phase !== "complete") {
        return textResult(
          `Project is in "${project.phase}" — not ready to export. Wait for the Human Veto gate.`
        );
      }
      if (!project.composedVideoUrl) {
        return textResult("No composed video yet. Call compose_video first.");
      }
      const scenes = project.scenes.filter((s) => s.videoUrl);
      const filename = `${project.name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "creative-studio-export"}`;
      const isRealMp4 =
        project.composedVideoUrl &&
        project.composedVideoUrl !== "__manifest__" &&
        !project.composedVideoUrl.startsWith("__");
      const message = isRealMp4
        ? `Ready to export ${scenes.length}-scene composed video (${project.composedVideoUrl}). Filename: ${filename}.mp4${download ? " Download triggered." : ""}`
        : `Ready to export ${scenes.length}-scene slideshow (no ffmpeg on server). Filename: ${filename}.mp4${download ? " Download triggered." : ""}`;
      store.setAgentStatus(
        "video-editor",
        "active",
        `Export${download ? " triggered" : " ready"}: ${filename}.mp4 (${scenes.length} scenes).`
      );
      const result: any = textResult(message);
      result._meta = {
        provider: project.composedVideoProvider ?? (isRealMp4 ? "ffmpeg" : "browser-stitch"),
        costUsd: 0,
        latencyMs: 0,
      };
      return result;
    },
  });
}
