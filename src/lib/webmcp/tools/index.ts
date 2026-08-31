import type { WebMCPTool } from "@/types";
import type { useStudioStore } from "@/lib/store/useStudioStore";

import { createProjectTool } from "./createProject";
import { generateScriptTool } from "./generateScript";
import { createStoryboardTool } from "./createStoryboard";
import { generateImageTool } from "./generateImage";
import { textToVideoTool } from "./textToVideo";
import { imageToVideoTool } from "./imageToVideo";
import { textToSpeechTool } from "./textToSpeech";
import { composeVideoTool } from "./composeVideo";
import { writeCaptionTool } from "./writeCaption";
import { reviewVideoTool } from "./reviewVideo";
import { requestHumanApprovalTool } from "./requestHumanApproval";
import { getProjectRoadmapTool } from "./getProjectRoadmap";
import { getProjectStatusTool } from "./getProjectStatus";
import { refineSceneTool } from "./refineScene";
import { exportVideoTool } from "./exportVideo";
import { listAvailableProvidersTool } from "./listAvailableProviders";
import { proceduralVideoTool } from "./proceduralVideo";

type Store = ReturnType<typeof useStudioStore.getState>;

// Every tool is a factory over the current store snapshot so `execute`
// closures always read/write live state rather than a stale capture.
export function buildAllTools(store: Store): WebMCPTool[] {
  return [
    createProjectTool(store),
    generateScriptTool(store),
    createStoryboardTool(store),
    generateImageTool(store),
    textToVideoTool(store),
    imageToVideoTool(store),
    textToSpeechTool(store),
    writeCaptionTool(store),
    composeVideoTool(store),
    reviewVideoTool(store),
    requestHumanApprovalTool(store),
    getProjectRoadmapTool(store),
    getProjectStatusTool(store),
    refineSceneTool(store),
    exportVideoTool(store),
    listAvailableProvidersTool(),
    proceduralVideoTool(store),
  ];
}
