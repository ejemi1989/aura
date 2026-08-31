import type { useStudioStore } from "@/lib/store/useStudioStore";
import type { WebMCPClient, WebMCPExecuteOptions, WebMCPTool } from "@/types";
import { textResult } from "@/lib/webmcp/toolResult";
import { defineTool } from "@/lib/webmcp/defineTool";
import { waitForHumanDecision } from "@/lib/webmcp/approvalBridge";
import { threadHumanDecision, threadToolRun } from "@/lib/supabase/threading";

type Store = ReturnType<typeof useStudioStore.getState>;
type Input = { summary: string; detail: string };

/**
 * The human veto. Per the WebMCP requirement.md and security FAQ,
 * this is a consequential action — it pauses execution and asks the
 * human to approve. We don't have a normative spec field for that
 * yet (issue #176), so we co-opt the `readOnlyHint` + a careful
 * description to communicate intent.
 */
export function requestHumanApprovalTool(store: Store): WebMCPTool<Input> {
  return defineTool<Input>({
    name: "request_human_approval",
    title: "Request human approval",
    description:
      "Pauses the campaign and asks the human to approve or reject before proceeding. The human " +
      "veto: call it before marking a campaign complete, before anything would be published or sent " +
      "externally, and any other time a specialist's output needs a human sign-off. Execution does " +
      "not resume until the human responds. Use sparingly — this is a blocking checkpoint.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-line summary of what's being approved." },
        detail: { type: "string", description: "Fuller context the human needs to decide." },
      },
      required: ["summary", "detail"],
    },
    annotations: {
      // Per the security FAQ (security.md), tools that trigger user-visible
      // side effects should be flagged so the agent doesn't fire them
      // without confirming the user is present. The spec doesn't have a
      // dedicated field for this yet (issue #176); `readOnlyHint: false`
      // (the default) is the closest current signal, paired with a clear
      // description above.
      readOnlyHint: false,
      untrustedContentHint: false,
    },
    execute: async (input, options) => {
      const { summary, detail } = input;
      const client: WebMCPClient = {
        requestUserInteraction: async <T,>(cb: () => Promise<T> | T) => cb(),
      };
      const approvalId = store.requestApproval({
        requestedBy: "creative-director",
        summary,
        detail,
      });
      store.setAgentStatus(
        "creative-director",
        "blocked",
        `Waiting on human approval: ${summary}`
      );
      const supabaseProjectId = store.project.supabaseProjectId;

      // Per the WebMCP spec, sensitive/irreversible actions should pause
      // via requestUserInteraction so the confirmation is visible to
      // whatever is driving the tab — not silently auto-approved. In the
      // in-app flow, waitForHumanDecision() resolves when the on-screen
      // ApprovalModal is answered.
      if (options?.signal?.aborted) {
        store.resolveApproval(approvalId, false);
        throw new DOMException("Aborted", "AbortError");
      }
      const approved = await client.requestUserInteraction(() =>
        waitForHumanDecision(approvalId)
      );
      store.resolveApproval(approvalId, approved);
      // Persist the decision to Supabase (best-effort) so the approval is
      // durable across cold starts and tab refreshes — per the spec §30.
      await threadHumanDecision({
        projectSupabaseId: supabaseProjectId,
        decision: approved ? "approve" : "reject",
        instruction: detail,
      });
      await threadToolRun({
        projectSupabaseId: supabaseProjectId,
        toolName: "request_human_approval",
        agent: "creative-director",
        status: approved ? "success" : "rejected",
        input: { summary, detail },
        output: { approved, approvalId },
      });
      if (approved) {
        store.setPhase("approved");
        store.setAgentStatus("creative-director", "completed", `Human approved: ${summary}`);
        return textResult(`Approved by the human: "${summary}".`);
      }
      store.setPhase("revision");
      store.setAgentStatus("creative-director", "blocked", `Human rejected: ${summary}`);
      return textResult(`Rejected by the human: "${summary}". Replan or ask for guidance.`);
    },
  });
}
