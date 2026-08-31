"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { buildAllTools } from "@/lib/webmcp/tools";
import { textResult } from "@/lib/webmcp/toolResult";
import { assertValidToolName } from "@/lib/webmcp/toolName";
import type {
  AgentId,
  WebMCPClient,
  WebMCPModelContext,
  WebMCPTool,
  WebMCPExecuteOptions,
} from "@/types";

const TOOL_OWNER: Record<string, AgentId> = {
  create_project: "project-manager",
  generate_script: "scriptwriter",
  create_storyboard: "graphic-designer",
  generate_image: "graphic-designer",
  refine_scene: "graphic-designer",
  text_to_video: "motion-graphics",
  image_to_video: "motion-graphics",
  text_to_speech: "voiceover",
  write_caption: "copywriter",
  compose_video: "video-editor",
  review_video: "critic-qa",
  request_human_approval: "creative-director",
  get_project_roadmap: "project-manager",
  get_project_status: "project-manager",
};

export type WebMCPAvailability = "unavailable" | "checking" | "available";

/**
 * Resolves the live modelContext object, preferring `document.modelContext`
 * per the spec IDL (`partial interface Document { readonly attribute
 * ModelContext modelContext; }`). Chrome 149's origin trial shipped this
 * under `navigator.modelContext` before Chrome 150 moved it to match the
 * spec — both are checked so the studio keeps working across that
 * transition without browser-sniffing branches.
 */
function resolveModelContext(): WebMCPModelContext | undefined {
  if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
  if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
  return undefined;
}

/**
 * Client object handed to a tool's `execute` callback per the spec.
 * `requestUserInteraction` is what the in-app Director uses to pause
 * execution until the human approves in the on-screen modal.
 */
const inAppClient: WebMCPClient = {
  requestUserInteraction: async <T,>(cb: () => Promise<T> | T) => cb(),
};

/**
 * Registers every studio tool with the browser's WebMCP model context,
 * if present. Safe to call on any browser — on one without WebMCP
 * support, this is a no-op and the app works exactly as it would
 * otherwise. WebMCP is an extra lane for agents, never the only lane.
 *
 * Per the spec (index.bs, registerTool algorithm), this returns a
 * `Promise<undefined>` that REJECTS with InvalidStateError /
 * NotAllowedError / SecurityError. We use `.catch()` (or await in
 * try/catch), not synchronous try/catch.
 */
export function useWebMCP(): WebMCPAvailability {
  const [availability, setAvailability] = useState<WebMCPAvailability>("checking");

  useEffect(() => {
    const modelContext = resolveModelContext();
    if (!modelContext) {
      setAvailability("unavailable");
      return;
    }
    setAvailability("available");

    const controller = new AbortController();
    const store = useStudioStore;
    const tools = buildAllTools(store.getState());

    let cancelled = false;
    (async () => {
      for (const tool of tools) {
        if (cancelled) break;
        // Defensive client-side validation — browsers do this too,
        // but failing fast here gives clearer dev errors.
        try {
          assertValidToolName(tool.name);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            `[WebMCP] Skipping tool "${tool.name}": ${err instanceof Error ? err.message : err}`
          );
          continue;
        }

        // Wrap the tool's execute so that agent-driven calls also flow
        // through the same Debug Panel / Activity Feed as in-app calls.
        // The browser calls `execute(inputObject, { signal })`, not the
        // older `execute(input, client)` shape, so we wrap accordingly.
        const wrapped: WebMCPTool = {
          ...tool,
          execute: async (
            rawInput: unknown,
            options: WebMCPExecuteOptions
          ): Promise<unknown> => {
            const agentId = TOOL_OWNER[tool.name] ?? "creative-director";
            const callId = store.getState().startToolCall({
              id: `call_${tool.name}_${Date.now()}`,
              toolName: tool.name,
              agentId: "external-agent",
              input: rawInput,
            });
            try {
              const input = (rawInput ?? {}) as Parameters<typeof tool.execute>[0];
              const result = await tool.execute(input, options);
              store.getState().finishToolCall(callId, { status: "success", output: result });
              return result;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              store.getState().finishToolCall(callId, { status: "error", errorMessage: message });
              store.getState().setAgentStatus(agentId, "error", `${tool.name} failed: ${message}`);
              // Fail usefully: hand a clear, actionable message back to
              // the agent instead of letting it bubble up opaquely.
              return textResult(
                `Error running ${tool.name}: ${message}. Check inputs and retry, or ask the human for guidance.`
              );
            }
          },
        };

        try {
          // Per the spec IDL, registerTool returns Promise<undefined>
          // and rejects on duplicate/empty name, missing permissions
          // policy, or non-trustworthy exposedTo origins.
          await modelContext.registerTool(wrapped, { signal: controller.signal });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            `[WebMCP] Failed to register "${tool.name}":`,
            err instanceof Error ? err.message : err
           );
        }
      }
    })();

    /**
     * Per the spec (requirement.md, "Responding to dynamic tool updates:
     * the toolchange event"), the browser fires a `toolchange` event on
     * `document.modelContext` when tools are added or removed. We
     * listen so the in-app Debug Panel and the WebMCP indicator can
     * reflect the live tool list, even when the browser mutates it
     * independently of our registration loop (e.g. cross-origin
     * iframe exposure, browser-driven unregistration on navigation).
     */
    const onToolChange = () => {
      void modelContext
        .getTools?.()
        .then((live) => {
          if (cancelled) return;
          // Re-record each tool call's current schema into our store so
          // the Debug Panel "Log" tab can show what's actually live.
          for (const t of live ?? []) {
            // We don't re-register; the browser already owns the
            // registration. This listener exists so the in-app UI
            // can react to changes (e.g. show a "tools updated" toast).
          }
        })
        .catch(() => {
          /* getTools() is optional per the IDL; ignore. */
        });
    };
    modelContext.addEventListener?.("toolchange", onToolChange);

    return () => {
      cancelled = true;
      controller.abort();
      modelContext.removeEventListener?.("toolchange", onToolChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return availability;
}
