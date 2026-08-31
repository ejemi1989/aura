// Google Veo 3 provider for image-to-video and text-to-video.
//
// Veo is Google's flagship video generation model. As of mid-2025, Veo 3
// (and 3.1) is available via the Gemini API's `predictLongRunning`
// operation, which mirrors the async-queue pattern fal uses: submit a
// generation request, receive an operation name, poll until `done: true`,
// then extract the generated video URI.
//
// Auth: pass `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) in the environment;
// the provider sends it as the `x-goog-api-key` header on every request.
//
// Models (override via env):
//   - VEO_MODEL               default: auto-discovered highest-quality
//   - VEO_FAST_MODEL          default: auto-discovered fast variant
//   - VEO_IMAGE_TO_VIDEO_MODEL default: auto-discovered
//   - VEO_TEXT_TO_VIDEO_MODEL  default: auto-discovered
//
// In demo mode (no key set) we don't throw — the upstream route falls back
// to the deterministic placeholder clip. This file only exports when a
// real key is present (callers check via config.googleVeoConfigured()).

import { mirrorRemoteAsset } from "./http";
import { retryWithBackoff } from "./retry";
import { limiters } from "./rateLimiter";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function googleApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

export function veoConfigured(): boolean {
  return !!googleApiKey();
}

// Probes the user's Google project for any Veo model and caches the
// verdict in-process for 10 minutes. Lets the i2v/t2v routes gracefully
// fall back to demo mode when the user has a Gemini-only key (no Veo
// access) instead of returning a hard 502 on every request.
//
// Also caches the BEST available Veo model name so the actual predict
// call uses a model that exists in the user's project — older defaults
// like `veo-3.0-generate-preview` return 404 for projects that only have
// Veo 3.1. Auto-discovery makes the provider forward-compatible.
let _veoProbe: { available: boolean; model: string; fastModel: string; expiresAt: number } | null = null;
export async function veoModelAvailable(): Promise<boolean> {
  if (!googleApiKey()) return false;
  if (_veoProbe && _veoProbe.expiresAt > Date.now()) return _veoProbe.available;
  try {
    const url = `${GEMINI_BASE}/models?key=${encodeURIComponent(googleApiKey()!)}&pageSize=200`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      _veoProbe = { available: false, model: "", fastModel: "", expiresAt: Date.now() + 60_000 };
      return false;
    }
    const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const veoModels = (data.models ?? [])
      .map((m) => m.name ?? "")
      .filter((n) => /veo/i.test(n) && !/embedding|image/i.test(n));
    // Prefer the highest-quality "generate" variant (no -fast/-lite suffix).
    // Fast/lite variants are LONGER names but LOWER quality — sort by
    // preference score so the regular variant wins, then fall through to
    // newer versions by sorting numerically (3.1 > 3.0).
    const score = (n: string) => {
      let s = 0;
      if (!/-fast-generate-preview|-lite-generate-preview/.test(n)) s += 1000; // prefer "full" quality
      const ver = n.match(/veo-(\d+)\.(\d+)/);
      if (ver) s += parseInt(ver[1], 10) * 100 + parseInt(ver[2], 10); // 3.1 > 3.0
      return s;
    };
    const sorted = [...new Set(veoModels)].sort((a, b) => score(b) - score(a));
    const best = sorted[0] ?? "";
    const fast = sorted.find((n) => /-fast-generate-preview|-lite-generate-preview/.test(n)) ?? best;
    _veoProbe = {
      available: veoModels.length > 0,
      model: best,
      fastModel: fast,
      expiresAt: Date.now() + 10 * 60_000,
    };
    return veoModels.length > 0;
  } catch {
    _veoProbe = { available: false, model: "", fastModel: "", expiresAt: Date.now() + 60_000 };
    return false;
  }
}

/**
 * Resolve the best Veo model name to use for a given kind. Honors env
 * overrides first; otherwise picks the auto-discovered best/fast model
 * from the latest probe; otherwise falls back to a sensible default that
 * works on most projects.
 */
function veoModel(kind: "i2v" | "t2v"): string {
  const envOverride = kind === "i2v"
    ? (process.env.VEO_IMAGE_TO_VIDEO_MODEL ?? process.env.VEO_MODEL)
    : (process.env.VEO_TEXT_TO_VIDEO_MODEL ?? process.env.VEO_MODEL);
  if (envOverride) return stripModelPrefix(envOverride);
  if (_veoProbe && _veoProbe.expiresAt > Date.now()) {
    return stripModelPrefix(_veoProbe.model);
  }
  // Conservative default — works on Google's public Veo projects. Will
  // be replaced by the probe's auto-discovered model on the first call
  // that triggers `veoModelAvailable()`.
  return "veo-3.1-generate-preview";
}

// Probe returns full names like "models/veo-3.1-generate-preview"; the
// predict endpoint wants just the model id without the prefix.
function stripModelPrefix(name: string): string {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

export interface VideoResult {
  url: string;
  model: string;
  durationSeconds?: number;
}

export type VeoProgress = (status: "submitting" | "polling" | "done" | "failed") => void;

interface VeoSubmitResponse {
  name: string;
}

interface VeoPollResponse {
  name: string;
  done?: boolean;
  response?: {
    generatedVideos?: { video?: { uri?: string; bytesBase64Encoded?: string; mimeType?: string } }[];
  };
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Submit a generation request to Veo's predictLongRunning endpoint. Returns
 * the operation name (a string like `operations/abc123`), which we then
 * poll via `veoPoll`. The base64-encoded image goes in `instances[0].image`.
 */
async function veoSubmit(
  kind: "i2v" | "t2v",
  body: {
    prompt: string;
    image?: { uri?: string; bytesBase64Encoded?: string; mimeType?: string };
    durationSeconds?: number;
  }
): Promise<string> {
  const key = googleApiKey();
  if (!key) throw new Error("GOOGLE_API_KEY not set");
  const model = veoModel(kind);

  const instance: Record<string, unknown> = { prompt: body.prompt };
  if (body.image) {
    instance.image = body.image.uri
      ? { uri: body.image.uri, mimeType: body.image.mimeType ?? "image/png" }
      : { bytesBase64Encoded: body.image.bytesBase64Encoded, mimeType: body.image.mimeType ?? "image/png" };
  }
  const parameters: Record<string, unknown> = {
    sampleCount: 1,
    aspectRatio: "16:9",
  };
  // Veo accepts durationSeconds only in [4, 8] (inclusive). A scene slot
  // can be any value (e.g. a 12s narration slot > 8), but Veo rejects
  // anything out of range with a 400 INVALID_ARGUMENT — which previously
  // made the whole job fall back to a demo clip. Clamp to the supported
  // window as the single source of truth: this is the max the provider
  // can produce regardless of what the orchestrator requested.
  if (body.durationSeconds) {
    parameters.durationSeconds = Math.min(8, Math.max(4, Math.round(Number(body.durationSeconds))));
  }

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`;
  const res = await retryWithBackoff(
    () =>
      fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instances: [instance], parameters }),
      }),
    { retries: 3, baseMs: 1000, maxMs: 8000 }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`veo submit failed: ${res.status} ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as VeoSubmitResponse;
  if (!data?.name) throw new Error("veo submit returned no operation name");
  return data.name;
}

async function veoPoll(operationName: string, signal: AbortSignal): Promise<VeoPollResponse> {
  const key = googleApiKey();
  if (!key) throw new Error("GOOGLE_API_KEY not set");
  // The operation name is already a full path segment like
  // "operations/abc..." or sometimes returned as just an id; the Gemini
  // API accepts the full name on the GET path.
  const tail = operationName.startsWith("operations/") ? operationName : `operations/${operationName}`;
  const url = `${GEMINI_BASE}/${tail}`;
  const res = await retryWithBackoff(
    () =>
      fetch(url, {
        method: "GET",
        headers: { "x-goog-api-key": key },
        signal,
      }),
    { signal, retries: 4, baseMs: 1000, maxMs: 12000 }
  );
  if (!res.ok) {
    throw new Error(`veo poll failed: ${res.status}`);
  }
  return (await res.json()) as VeoPollResponse;
}

async function veoWaitForResult(
  operationName: string,
  signal: AbortSignal,
  onProgress?: VeoProgress
): Promise<VeoPollResponse> {
  // Veo 3 generation typically takes 30s–3min. 6 minute ceiling covers
  // the long tail without hanging the demo forever.
  const deadline = Date.now() + 6 * 60_000;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("aborted");
    const r = await veoPoll(operationName, signal);
    if (r.done && r.response?.generatedVideos?.length) {
      onProgress?.("done");
      return r;
    }
    if (r.error) {
      onProgress?.("failed");
      throw new Error(`veo job failed: ${r.error.message ?? r.error.status ?? "unknown"}`);
    }
    onProgress?.("polling");
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("veo job timed out after 6 minutes");
}

/**
 * Extract the video URI or inline bytes from a completed Veo operation
 * response. Veo returns `generatedVideos[0].video.uri` (a signed URL to
 * GCS) or `bytesBase64Encoded` (rare for video). We mirror the URI to
 * our asset store so the browser can play it without an authenticated
 * cross-origin fetch.
 */
async function extractVeoVideoUrl(result: VeoPollResponse): Promise<{ url: string }> {
  const v = result.response?.generatedVideos?.[0]?.video;
  if (!v) throw new Error("veo result has no video payload");
  if (v.uri) {
    const mirrored = await mirrorRemoteAsset(v.uri, { ext: "mp4", prefix: "veo" });
    return { url: mirrored };
  }
  if (v.bytesBase64Encoded) {
    const buffer = Buffer.from(v.bytesBase64Encoded, "base64");
    const { persistAsset } = await import("./assetStore");
    const stored = await persistAsset(buffer, {
      ext: "mp4",
      prefix: "veo",
      contentType: v.mimeType ?? "video/mp4",
    });
    return { url: stored };
  }
  throw new Error("veo result has neither uri nor bytesBase64Encoded");
}

/** Image-to-video via Veo 3. Mirrors the fal-style submit/poll/mirror
 *  pipeline so the route handler can stay provider-agnostic.
 *
 *  Veo 3.1 (and later) requires `bytesBase64Encoded` rather than `uri` for
 *  the source image — the API rejects uri with 400 INVALID_ARGUMENT.
 *  We fetch the local /assets image (or remote URL) and base64-encode it.
 *
 *  Pass 36: hold the veo semaphore for the full submit+wait+mirror
 *  pipeline. Veo's per-account concurrent-job limit is low (typically
 *  2-3); the orchestrator's `runInParallel(concurrency=3)` would
 *  breach it without the semaphore. */
export async function veoImageToVideo(
  imageUrl: string,
  prompt: string,
  durationSeconds: number,
  onProgress?: VeoProgress
): Promise<VideoResult> {
  const controller = new AbortController();
  return limiters.veo.run(async () => {
    onProgress?.("submitting");
    const { bytesBase64Encoded, mimeType } = await fetchImageAsBase64(imageUrl);
    const opName = await veoSubmit("i2v", {
      prompt,
      image: { bytesBase64Encoded, mimeType },
      durationSeconds,
    });
    const result = await veoWaitForResult(opName, controller.signal, onProgress);
    const { url } = await extractVeoVideoUrl(result);
    return { url, model: veoModel("i2v"), durationSeconds };
  });
}

/** Download an image (local /assets/... or remote URL) and return it as
 *  base64 + mimeType so it can be embedded in a Veo predict request. */
async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  // Local /assets/... — read from disk so we don't hit the dev server.
  if (imageUrl.startsWith("/assets/") || imageUrl.startsWith("assets/")) {
    const { readFile } = await import("node:fs/promises");
    const path = imageUrl.replace(/^\/?assets\//, "public/assets/");
    const buf = await readFile(path);
    const ext = path.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "webp" ? "image/webp" :
      "image/png";
    return { bytesBase64Encoded: buf.toString("base64"), mimeType };
  }
  // Remote URL — fetch and encode.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch source image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "image/png";
  return { bytesBase64Encoded: buf.toString("base64"), mimeType: ct.split(";")[0] };
}

/** Text-to-video via Veo 3. Pass 36: hold the veo semaphore for the
 *  full submit+wait+mirror pipeline. */
export async function veoTextToVideo(
  prompt: string,
  durationSeconds: number,
  onProgress?: VeoProgress
): Promise<VideoResult> {
  const controller = new AbortController();
  return limiters.veo.run(async () => {
    onProgress?.("submitting");
    const opName = await veoSubmit("t2v", { prompt, durationSeconds });
    const result = await veoWaitForResult(opName, controller.signal, onProgress);
    const { url } = await extractVeoVideoUrl(result);
    return { url, model: veoModel("t2v"), durationSeconds };
  });
}
