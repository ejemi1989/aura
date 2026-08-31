import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { READ_ONLY_ANNOTATIONS } from "@/lib/webmcp/toolName";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = Record<string, never>;

export function getProjectStatusTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "get_project_status",
    title: "Get project status",
    description:
      "Project Manager agent. Does NOT create or judge content. Returns a snapshot of the current " +
      "project: name, phase, per-scene asset completeness, and any open QA notes or pending " +
      "approvals. Read-only; safe to call at any time, including before deciding what to do next.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: () => {
      const p = store.getProject();
      const sceneLines = p.scenes.map((s) => {
        const parts = [
          s.imageUrl ? "image" : null,
          s.videoUrl ? "video" : null,
          s.voiceoverUrl ? "voiceover" : null,
          s.caption ? "caption" : null,
        ].filter(Boolean);
        return `  scene_${s.index} (${s.id}): ${parts.length ? parts.join(", ") : "no assets yet"}`;
      });
      const pending = store.getPendingApprovals().length;
      const qa = p.qaVerdict ? `QA verdict: ${p.qaVerdict}` : "QA: not yet reviewed";
      return textResult(
        [
          `Project: "${p.name}" — phase: ${p.phase}`,
          `Scenes (${p.scenes.length}):`,
          ...sceneLines,
          qa,
          pending > 0 ? `${pending} approval(s) awaiting the human right now.` : "No approvals pending.",
        ].join("\n")
      );
    },
  });
}
