import { NextRequest, NextResponse } from "next/server";
import { serverStore } from "@/lib/webmcp/serverStore";
import { badRequest } from "@/lib/providers/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/webmcp/assert { approvalId, approved }
 *
 * Lets the human (in the Control Room UI) approve or reject a pending
 * approval that an external WebMCP agent requested via
 * /api/webmcp/execute. The server-side request_human_approval returns
 * { status: "pending" } and queues the approval; this endpoint is how that
 * approval is resolved back into the agent's pipeline.
 */
export async function POST(req: NextRequest) {
  let body: { approvalId?: string; approved?: boolean };
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!body.approvalId || typeof body.approvalId !== "string") {
    return badRequest("Field 'approvalId' is required.", { approvalId: "required" });
  }
  const approved = body.approved === true;

  const pending = await serverStore.getPendingApprovals();
  const found = pending.some((a) => a.id === body.approvalId);
  if (!found) {
    return badRequest(`No pending approval with id "${body.approvalId}".`, { approvalId: "unknown" });
  }

  await serverStore.resolveApproval(body.approvalId);
  if (approved) {
    // The only pending approval in the pipeline is the terminal human gate.
    // Approving marks the project complete and unblocks the editor.
    await serverStore.setPhase("complete");
  }
  await serverStore.setAgentStatus(
    "creative-director",
    approved ? "completed" : "blocked",
    approved ? "Human approved the output." : "Human rejected the output — queued a remake."
  );

  return NextResponse.json({ ok: true, approvalId: body.approvalId, approved });
}
