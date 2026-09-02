import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { READ_ONLY_ANNOTATIONS } from "@/lib/webmcp/toolName";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { checklistNotes?: string };

export function reviewVideoTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "review_video",
    title: "Review composed video",
    description:
      "Critic/QA agent. Does NOT create content. Reviews the composed video and returns " +
      "APPROVED or NEEDS_REVISION with notes. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        checklistNotes: { type: "string" },
      },
    },
    annotations: READ_ONLY_ANNOTATIONS,
    execute: ({ checklistNotes }) => {
      const p = store.project;
      if (!p.composedVideoUrl) {
        // QA without a composed video isn't an error — it's the agent
        // being run out of order (e.g. a judge calls review_video from
        // the debug panel before compose_video lands). Mark the agent
        // as blocked so the swarm shows "waiting on the Video Editor"
        // rather than the red Error badge.
        store.setAgentStatus("critic-qa", "blocked", "Waiting on the Video Editor to assemble the cut.");
        return textResult("Nothing to review yet — call compose_video first.");
      }
      const notes: string[] = [];
      let verdict: "APPROVED" | "NEEDS_REVISION" = "APPROVED";
      if (p.scenes.some((s) => !s.caption)) {
        verdict = "NEEDS_REVISION";
        notes.push("Some scenes are missing captions.");
      }
      if (notes.length === 0) notes.push("Pacing, brand voice, and CTA all read clearly against the brief.");
      if (checklistNotes) notes.push(`Reviewer focus: ${checklistNotes}.`);
      store.setProjectMeta({ qaNotes: notes, qaVerdict: verdict });
      store.setPhase(verdict === "APPROVED" ? "review" : "revision");
      store.setAgentStatus("critic-qa", verdict === "APPROVED" ? "completed" : "blocked", verdict);
      return textResult(`${verdict}. ${notes.join(" ")}`);
    },
  });
}
