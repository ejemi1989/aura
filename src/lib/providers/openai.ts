// OpenAI provider implementations. Lazy-loads the SDK so routes that don't
// use OpenAI don't pay the import cost, and so absence of the package
// (e.g. on a worker that only uses fal) never crashes a build.
//
// Pass 36: image and TTS calls go through the `openai` rate limiter
// (counting semaphore, default capacity = 5). OpenAI's tier-based
// concurrent-request limit is usually generous, but the studio's
// `runInParallel(scenes, ..., concurrency=3)` orchestrator can still
// drive bursts that exceed the user's plan. The semaphore queues
// callers rather than 429-ing.

import OpenAI from "openai";
import { retryWithBackoff } from "./retry";
import { limiters } from "./rateLimiter";

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

export interface ImageResult {
  /** Public URL the browser can fetch (mirrored from OpenAI's ephemeral URL). */
  url: string;
  /** Provider model actually used, for the debug log. */
  model: string;
  revisedPrompt?: string;
}

/**
 * Generates a 16:9 image with gpt-image-1. OpenAI returns base64 PNG bytes
 * rather than a stable URL, so we persist them under /public/assets and
 * hand back a same-origin URL.
 *
 * gpt-image-1 supports: 1024x1024, 1024x1536, 1536x1024, and `auto`. The
 * legacy dall-e-3 sizes (1024x1792, 1792x1024) are NOT supported on
 * gpt-image-1 and return a 400 error — so we standardize on the
 * gpt-image-1 set, with `1536x1024` as the 16:9 default.
 */
export async function openaiGenerateImage(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024" | "auto" = "1536x1024"): Promise<ImageResult> {
  const { persistAsset } = await import("./http");
  const response = await limiters.openai.run(() =>
    retryWithBackoff(
      () =>
        client().images.generate({
          model: "gpt-image-1",
          prompt,
          n: 1,
          size,
        }),
      { retries: 3, baseMs: 1200, maxMs: 12000 }
    ),
  );

  const item = response.data?.[0];
  if (!item) {
    throw new Error("OpenAI returned no image data");
  }

  // gpt-image-1 returns b64_json; older dall-e-3 returned a `url`. Handle
  // both so swapping the model is a one-line change.
  let url: string;
  let revisedPrompt: string | undefined;
  if ("b64_json" in item && item.b64_json) {
    const buf = Buffer.from(item.b64_json, "base64");
    url = await persistAsset(buf, { ext: "png", prefix: "img", contentType: "image/png" });
  } else if ("url" in item && item.url) {
    const { mirrorRemoteAsset } = await import("./http");
    url = await mirrorRemoteAsset(item.url, { ext: "png", prefix: "img" });
  } else {
    throw new Error("OpenAI image response had neither b64_json nor url");
  }

  return { url, model: "gpt-image-1", revisedPrompt: "revised_prompt" in item ? item.revised_prompt ?? undefined : undefined };
}

export interface TtsResult {
  url: string;
  model: string;
  voice: string;
  durationMs?: number;
}

const VOICE_MAP: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
  warm: "nova",
  energetic: "alloy",
  authoritative: "onyx",
  calm: "echo",
  playful: "fable",
};

export async function openaiTTS(
  text: string,
  tone: keyof typeof VOICE_MAP | string = "warm"
): Promise<TtsResult> {
  const { persistAsset } = await import("./http");
  const voice = (VOICE_MAP[tone] ?? "alloy") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  const response = await limiters.openai.run(() =>
    retryWithBackoff(
      () =>
        client().audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice,
          input: text,
          response_format: "mp3",
        }),
      { retries: 3, baseMs: 1000, maxMs: 10000 }
    ),
  );
  const buf = Buffer.from(await response.arrayBuffer());
  const url = await persistAsset(buf, { ext: "mp3", prefix: "tts", contentType: "audio/mpeg" });
  // OpenAI's TTS response doesn't include a duration field, but bytes/sec
  // is a reasonable proxy for mp3 ~128kbps. We don't claim precision.
  const durationMs = Math.round((buf.length * 8) / 128);
  return { url, model: "gpt-4o-mini-tts", voice, durationMs };
}

export { client as openaiClient };
