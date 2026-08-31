import { useStudioStore } from "@/lib/store/useStudioStore";
import { buildAllTools } from "@/lib/webmcp/tools";
import { waitForHumanDecision } from "@/lib/webmcp/approvalBridge";
import { resultText } from "@/lib/webmcp/toolResult";
import type { AgentId, WebMCPClient } from "@/types";

/**
 * In-app analogue of `document.modelContext.client`. The spec gives
 * tool implementations a `WebMCPClient` whose only method is
 * `requestUserInteraction`; for in-app invocations from the Director
 * we just run the callback immediately.
 */
const inAppClient: WebMCPClient = {
  requestUserInteraction: async <T,>(cb: () => Promise<T> | T) => cb(),
};

/**
 * Runs one studio tool by name, exactly the way an external WebMCP
 * agent would, but from in-app code (the local Creative Director
 * orchestrator and the DebugPanel's "Run a tool" tab).
 *
 * The tool's `execute` signature matches the spec: `(input, options)`.
 * We pass `options.signal` as a fresh `AbortController.signal()` so
 * cancellation works consistently.
 *
 * The Debug Panel shows one unified trace regardless of who is driving
 * (in-app Director vs. external WebMCP agent). To make agent-driven
 * calls visually distinct we colour-code them by `origin` (passed in
 * by the caller; defaults to "in-app-director").
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  calledBy: AgentId | "human" | "external-agent" = "creative-director",
  options: { origin?: "in-app-director" | "human" | "external-agent" | "browser-agent" } = {}
): Promise<string> {
  const store = useStudioStore;
  const tools = buildAllTools(store.getState());
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return `Unknown tool "${name}".`;
  }

  const origin: "in-app-director" | "human" | "external-agent" | "browser-agent" =
    options.origin ??
    (calledBy === "external-agent"
      ? "external-agent"
      : calledBy === "human"
        ? "human"
        : "in-app-director");

  const startedAt = Date.now();
  const callId = store.getState().startToolCall({
    id: `call_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    toolName: name,
    agentId: calledBy,
    origin,
    input,
  });

  const ac = new AbortController();
  try {
    // Spec IDL: tools return any JSON-serializable value; we standardize
    // on the MCP-shaped `{ content: [{ type, text }] }` so external
    // agents and the in-app Director use the same contract.
    //
    // Tools may attach a private `_meta` field to attach provenance
    // (provider name, cost) for the Debug Panel. We strip it before
    // returning the public result.
    const raw = await tool.execute(input, { signal: ac.signal });
    const meta = (raw && typeof raw === "object" && "_meta" in (raw as any))
      ? (raw as any)._meta
      : undefined;
    const publicResult = meta
      ? { ...(raw as any) }
      : raw;
    if (publicResult && typeof publicResult === "object" && "_meta" in (publicResult as any)) {
      delete (publicResult as any)._meta;
    }
    const text = resultText(publicResult as any);
    const finishedAt = Date.now();
    store.getState().finishToolCall(callId, {
      status: "success",
      output: publicResult,
      finishedAt,
      latencyMs: finishedAt - startedAt,
      provider: meta?.provider,
      costUsd: meta?.costUsd,
    });
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.getState().finishToolCall(callId, {
      status: "error",
      errorMessage: message,
      finishedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
    });
    return `Error running ${name}: ${message}`;
  }
}

// Re-exported so the approval modal (human clicking Approve / Reject)
// can resolve whichever `request_human_approval` call is currently
// pending, whether it was triggered by the in-app Director or an
// external agent.
export { waitForHumanDecision };
