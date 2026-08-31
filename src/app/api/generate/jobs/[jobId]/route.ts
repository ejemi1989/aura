import { NextResponse } from "next/server";
import { getJob, publicJob } from "@/lib/providers/jobs";

export const runtime = "nodejs";

/**
 * Poll a background video-generation job.
 * GET /api/generate/jobs/:jobId
 *
 * Returns the status (`queued` | `running` | `succeeded` | `failed`) plus
 * any progress, error, or — on success — the same payload the synchronous
 * route returns (url, model, durationSeconds, mode, provider). 404 if the
 * job is unknown or has been swept.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "not_found", jobId, message: "Unknown or expired job." }, { status: 404 });
  }
  return NextResponse.json(publicJob(job));
}
