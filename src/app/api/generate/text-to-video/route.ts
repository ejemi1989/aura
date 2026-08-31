import { NextRequest, NextResponse } from "next/server";
import { textToVideoProvider, demoModeAllowed } from "@/lib/providers/config";
import { veoTextToVideo, veoConfigured, veoModelAvailable } from "@/lib/providers/google";
import { badRequest, notConfigured, upstreamErrorResponse } from "@/lib/providers/http";
import { renderDemoVideo, newAssetId } from "@/lib/providers/demoAssets";
import { createJob, updateJob, publicJob } from "@/lib/providers/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  prompt: string;
  durationSeconds?: number;
  projectId?: string;
  /** When true, start the job in the background and return { jobId } immediately. */
  async?: boolean;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!body.prompt || body.prompt.trim().length < 3) {
    return badRequest("Field 'prompt' is required and must be at least 3 characters.", {
      prompt: "required",
    });
  }

  const duration = clamp(body.durationSeconds ?? 5, 2, 30);
  const provider = textToVideoProvider();

  if (provider.name === "google" && veoConfigured()) {
    const veoUsable = await veoModelAvailable();
    if (veoUsable) {
      if (body.async === true) {
        const job = createJob<{
          mode: string;
          provider: string;
          url: string;
          model: string;
          durationSeconds: number;
        }>("text-to-video");
        job.status = "running";
        const run = (async () => {
          try {
            const result = await veoTextToVideo(body.prompt, duration, (st) => {
              updateJob(job.id, {
                status: "running",
                progress:
                  st === "submitting" ? 10 : st === "polling" ? 50 : st === "done" ? 100 : 20,
              });
            });
            updateJob(job.id, {
              status: "succeeded",
              progress: 100,
              result: {
                mode: "live",
                provider: "google",
                url: result.url,
                model: result.model,
                durationSeconds: result.durationSeconds,
              },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            updateJob(job.id, { status: "failed", error: message });
          }
        })();
        job._settle = run;
        return NextResponse.json({ jobId: job.id, ...publicJob(job) }, { status: 202 });
      }

      try {
        const result = await veoTextToVideo(body.prompt, duration);
        return NextResponse.json({
          mode: "live",
          provider: "google",
          url: result.url,
          model: result.model,
          durationSeconds: result.durationSeconds,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[t2v] Veo call failed, falling back to demo: ${message}`);
      }
    } else {
      console.warn(
        "[t2v] GOOGLE_API_KEY is set but no Veo models are available for this key — falling back to demo.",
      );
    }
  }

  if (!demoModeAllowed()) {
    return notConfigured(provider.name, "text-to-video");
  }

  // Demo path: real mp4 (color card with the prompt as overlay) when
  // ffmpeg is available, otherwise a stub. The VideoPreview plays the
  // real mp4 with native controls; the stub falls back to the slideshow.
  const id = newAssetId("t2v");
  const { url } = await renderDemoVideo(id, body.prompt, duration);
  return NextResponse.json({
    mode: "demo",
    provider: "demo",
    url,
    model: "demo-clip",
    durationSeconds: duration,
    note:
      "Demo mode — rendered a real placeholder clip with ffmpeg. Set GOOGLE_API_KEY (Veo 3, recommended) for real video. Set DEMO_MODE=false to disable placeholders.",
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
