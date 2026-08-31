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
