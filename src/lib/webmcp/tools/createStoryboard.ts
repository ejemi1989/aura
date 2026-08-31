import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { visualStyleNotes: string };

export function createStoryboardTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "create_storyboard",
    title: "Create storyboard",
    description:
      "Graphic Designer agent: turns the existing script scenes into a storyboard by writing a " +
      "concrete image-generation prompt for each scene. Call after generate_script and before " +
      "generate_image.",
    inputSchema: {
      type: "object",
      properties: {
        visualStyleNotes: {
          type: "string",
          description: "Art-direction notes to apply across every scene.",
        },
      },
      required: ["visualStyleNotes"],
    },
    execute: ({ visualStyleNotes }) => {
      const scenes = store.project.scenes;
      if (scenes.length === 0) {
        return textResult("No scenes found. Call generate_script first.");
      }
      for (const s of scenes) {
        store.updateScene(s.id, { imagePrompt: `${s.description} — ${visualStyleNotes}` });
      }
      store.setPhase("storyboard");
      store.setAgentStatus("graphic-designer", "active", `Wrote prompts for ${scenes.length} scenes.`);
      return textResult(`Storyboarded ${scenes.length} scenes. Ready for generate_image.`);
    },
  });
}
