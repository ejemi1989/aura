// fal.ai provider for image-to-video and text-to-video. fal's queue API
// is the de-facto standard for hosted video models (Kling, Luma, Runway
// through their hosted endpoints, Minimax, etc.) so this layer is reusable
// across whichever video model the team has access to.
//
// In demo mode (no key set) we return a stable placeholder so the studio
// remains runnable; production deployments set FAL_KEY and choose a real
// model via the FAL_VIDEO_MODEL env var (default kling-video/v1/standard/image-to-video).
//
// Pass 36: all fal calls go through the `fal` rate limiter (capacity = 3
// by default). fal's hosted models have a per-account concurrency limit
// that varies by plan; queueing via the semaphore keeps the studio from
// 429-ing when the orchestrator fires 5 in parallel.
//
// NOTE: per .context/system.md §45 (DO NOT DO list), fal.ai is NOT in the
// studio's primary provider chain. This file is preserved so a deployment
// that explicitly opts into fal via the provider config (or via a future
// override) still has a working integration. No code path in src/app/api/
// or src/lib/agents/ calls into this module as a primary route.

import { mirrorRemoteAsset } from "./http";
import { retryWithBackoff } from "./retry";
import { limiters } from "./rateLimiter";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_RESULT_BASE = "https://queue.fal.run";

interface FalSubmitResponse {
  request_id: string;
  status?: string;
  response_url?: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  video?: { url: string; content_type?: string };
  logs?: { message: string }[];
  error?: string;
}

async function falSubmit(model: string, input: Record<string, unknown>): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");
  const res = await retryWithBackoff(
    () =>
      fetch(`${FAL_QUEUE_BASE}/${model}`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    { retries: 3, baseMs: 1000, maxMs: 8000 }
  );
  if (!res.ok) {
    throw new Error(`fal submit failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as FalSubmitResponse;
  return data.request_id;
}

async function falPoll(model: string, requestId: string, signal: AbortSignal): Promise<FalStatusResponse> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");
  const res = await retryWithBackoff(
    () =>
      fetch(`${FAL_RESULT_BASE}/${model}/requests/${requestId}/status`, {
        headers: { "Authorization": `Key ${key}` },
        signal,
      }),
    { signal, retries: 4, baseMs: 800, maxMs: 10000 }
  );
  if (!res.ok) {
    throw new Error(`fal status failed: ${res.status}`);
  }
  return (await res.json()) as FalStatusResponse;
}

async function falWaitForResult(
  model: string,
  requestId: string,
  signal: AbortSignal,
  onProgress?: (status: FalStatusResponse["status"]) => void
): Promise<FalStatusResponse> {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("aborted");
    const status = await falPoll(model, requestId, signal);
    onProgress?.(status.status);
    if (status.status === "COMPLETED") return status;
    if (status.status === "FAILED") {
      throw new Error(`fal job failed: ${status.error ?? "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("fal job timed out after 5 minutes");
}

export interface VideoResult {
  url: string;
  model: string;
  durationSeconds?: number;
}

export type FalProgress = (status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED") => void;

export async function falImageToVideo(
  imageUrl: string,
  prompt: string,
  durationSeconds: number,
  onProgress?: FalProgress
): Promise<VideoResult> {
  const model = process.env.FAL_VIDEO_MODEL ?? "fal-ai/kling-video/v1/standard/image-to-video";
  // Pass 36: hold the fal semaphore for the entire submit+wait+mirror
  // pipeline. The upstream "concurrent request" limit is per-account,
  // so a long-running video job occupies the slot until completion —
  // releasing it earlier (e.g. right after submit) would let the
  // orchestrator's parallel runInParallel fire off more submits than
  // the account allows. Mirror counts as local I/O so we keep it
  // inside the permit too.
  const controller = new AbortController();
  const result = await limiters.fal.run(async () => {
    const reqId = await falSubmit(model, {
      image_url: imageUrl,
      prompt,
      duration: String(durationSeconds),
    });
    const res = await falWaitForResult(model, reqId, controller.signal, onProgress);
    if (!res.video?.url) {
      throw new Error("fal returned no video URL");
    }
    const mirrored = await mirrorRemoteAsset(res.video.url, { ext: "mp4", prefix: "i2v" });
    return { url: mirrored, model, durationSeconds };
  });
  return result;
}

export async function falTextToVideo(
  prompt: string,
  durationSeconds: number,
  onProgress?: FalProgress
): Promise<VideoResult> {
  const model = process.env.FAL_T2V_MODEL ?? "fal-ai/kling-video/v1/standard/text-to-video";
  const controller = new AbortController();
  const result = await limiters.fal.run(async () => {
    const reqId = await falSubmit(model, {
      prompt,
      duration: String(durationSeconds),
    });
    const res = await falWaitForResult(model, reqId, controller.signal, onProgress);
    if (!res.video?.url) {
      throw new Error("fal returned no video URL");
    }
    const mirrored = await mirrorRemoteAsset(res.video.url, { ext: "mp4", prefix: "t2v" });
    return { url: mirrored, model, durationSeconds };
  });
  return result;
}
