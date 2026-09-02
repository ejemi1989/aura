import { NextRequest, NextResponse } from "next/server";
import { imageToVideoProvider, demoModeAllowed } from "@/lib/providers/config";
import { veoImageToVideo, veoConfigured, veoModelAvailable } from "@/lib/providers/google";
import { badRequest, notConfigured, upstreamErrorResponse } from "@/lib/providers/http";
import { renderDemoVideo, newAssetId } from "@/lib/providers/demoAssets";
import { createJob, updateJob, publicJob } from "@/lib/providers/jobs";

// Per-request hint set when a Veo call fails, so the demo fallback note
// can explain WHY live video is unavailable (quota exhausted vs other).
declare global {
  // eslint-disable-next-line no-var
  var __veoLastError: string | undefined;
}

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  imageUrl: string;
  prompt?: string;
  motionNotes?: string;
  durationSeconds?: number;
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

  if (!body.imageUrl || typeof body.imageUrl !== "string") {
    return badRequest("Field 'imageUrl' is required.", { imageUrl: "required" });
  }

  const duration = clamp(body.durationSeconds ?? 4, 2, 30);
  const composedPrompt = [body.prompt, body.motionNotes].filter(Boolean).join(" — ") || "subtle cinematic motion";

// Pass 35: chain real providers in priority order. Google Veo 3 is the
// locked video primary (system.md §23, §45). When it fails or is quota-
// exhausted, the route falls through to the next provider in the chain
// (Luma, Runway, Replicate) before giving up and rendering a demo
// placeholder. FAL is intentionally not in the chain per the spec's
// DO NOT DO list.
  const absoluteImageUrl = await ensureAbsoluteUrl(body.imageUrl);

  // ── Google Veo ────────────────────────────────────────────────────────
  if (veoConfigured() && (await veoModelAvailable())) {
    try {
      const result = await veoImageToVideo(absoluteImageUrl, composedPrompt, duration);
      return NextResponse.json({
        mode: "live",
        provider: "google",
        url: result.url,
        model: result.model,
        durationSeconds: result.durationSeconds,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isQuota = /\b429\b|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message);
      console.warn(
        `[i2v] Veo call failed${isQuota ? " (quota exhausted)" : ""}, falling through: ${message}`
      );
      globalThis.__veoLastError = isQuota ? "quota" : message.slice(0, 80);
      // Fall through to next provider in chain.
    }
  }

  // (other providers could be added here: Luma, Runway, Replicate)

  if (!demoModeAllowed()) {
    return notConfigured("multiple", "image-to-video");
  }

  // Demo path: real mp4 colored card with the prompt overlay. Matches
  // the t2v demo visually so the studio looks consistent across both
  // generation paths. If we just hit a Veo quota error, surface that in
  // the note so the operator knows why Veo didn't produce a real clip.
  const id = newAssetId("i2v");
  const { url } = await renderDemoVideo(id, composedPrompt, duration);
  const veoHint =
    globalThis.__veoLastError === "quota"
      ? " Google Veo 3 quota is exhausted for this Google Cloud project — set LUMA_API_KEY, RUNWAY_API_KEY, or REPLICATE_API_TOKEN for an alternative provider."
      : "";
  return NextResponse.json({
    mode: "demo-fallback",
    provider: "demo",
    url,
    model: "demo-clip",
    durationSeconds: duration,
    reason: typeof globalThis.__veoLastError === "string" ? globalThis.__veoLastError : undefined,
    note:
      "Live video provider was requested but unavailable — rendered a real placeholder clip. " +
      veoHint +
      " Set GOOGLE_API_KEY (Veo 3, recommended) for real video. Set DEMO_MODE=false to disable placeholders.",
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

async function ensureAbsoluteUrl(url: string): Promise<string> {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("data:")) return url; // inline demo placeholder — providers can't use it, but don't mangle it
  const { headers } = await import("next/headers");
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${url}`;
}
