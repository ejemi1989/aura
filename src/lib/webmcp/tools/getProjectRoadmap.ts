import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { READ_ONLY_ANNOTATIONS } from "@/lib/webmcp/toolName";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = Record<string, never>;

export function getProjectRoadmapTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "get_project_roadmap",
    title: "Get project roadmap",
    description:
      "Project Manager agent. Does NOT create or judge content. Returns the full production roadmap " +
      "and the current phase. Read-only; safe to call at any time.",
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: () => {
      const project = store.getProject();
      return textResult(
        `Current phase: "${project.phase}".\n\nProduction roadmap:\n` +
          "1. Brand Strategist — Positioning & guidelines\n" +
          "2. Scriptwriter — Narrative & script\n" +
          "3. Copywriter — Captions & on-screen text\n" +
          "4. Graphic Designer — Key visuals\n" +
          "5. Motion Graphics — Video generation\n" +
          "6. Voiceover — Narration audio\n" +
          "7. Video Editor — Assembly\n" +
          "8. Critic/QA — Quality gate\n" +
          "9. Creative Director — Human approval\n"
      );
    },
  });
}
