import { NextResponse } from "next/server";
import { serverStore } from "@/lib/webmcp/serverStore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/webmcp/get_state
 *
 * Returns the server-side WebMCP agent snapshot (the state an external agent
 * built by calling /api/webmcp/execute) so the Control Room UI can mirror it
 * live. The client hydrates this into its store, which is what makes an
 * external agent's calls and artifacts "show up in the studio."
 *
 * Each field mirrors the client store slice it hydrates:
 *   project, agentStatus, activity, pendingApprovals, toolCalls
 *
 * `toolCalls` is the recent server-side tool-call log (last 200). The
 * client merges these into its own tool-call log so the Debug Panel can
 * show "this came from an external agent" with provider + cost + latency.
 */
export async function GET() {
  const [project, agentStatus, activity, pendingApprovals, toolCalls] = await Promise.all([
    serverStore.getProject(),
    serverStore.getAgentStatus(),
    serverStore.getActivity(),
    serverStore.getPendingApprovals(),
    serverStore.getToolCalls(),
  ]);

  return NextResponse.json({ ok: true, project, agentStatus, activity, pendingApprovals, toolCalls });
}
