import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { sceneId: string; purpose: "on_screen_text" | "post_caption" | "hook_line" };

export function writeCaptionTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "write_caption",
    title: "Write caption",
    description:
      "Copywriter agent: writes short-form on-screen text or a social caption for one scene.",
    inputSchema: {
      type: "object",
      properties: {
        sceneId: { type: "string" },
        purpose: {
          type: "string",
          enum: ["on_screen_text", "post_caption", "hook_line"],
          description: "Type of copy.",
        },
      },
      required: ["sceneId", "purpose"],
    },
    execute: ({ sceneId, purpose }) => {
      const scene = store.project.scenes.find((s) => s.id === sceneId);
      if (!scene) return textResult(`No scene with id "${sceneId}".`);
      const platform = store.project.brief?.platform ?? "generic";
      const text = draftCaption(scene.description, purpose, platform);
      store.updateScene(sceneId, { caption: text });
      store.addCaption(text);
      store.setAgentStatus("copywriter", "active", `Wrote ${purpose.replace("_", " ")} for scene ${scene.index}.`);
      return textResult(`Wrote ${purpose.replace("_", " ")}: "${text}"`);
    },
  });
}

function draftCaption(description: string, purpose: string, platform: string): string {
  const short = description.split(".")[0].slice(0, 60);
  if (purpose === "hook_line") return `Stop scrolling — ${short.toLowerCase()}`;
  if (purpose === "post_caption") return `${short}. Full story in the video. #${platform}`;
  return short;
}
