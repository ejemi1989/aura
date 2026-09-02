// Speechify text-to-speech provider, using the official `@speechify/api` SDK.
//
// Imported only by the server TTS route (never the client bundle). The SDK
// can read `SPEECHIFY_API_KEY` from the environment automatically, but we
// pass it explicitly so the error message is clear when it's missing. We
// persist the returned audio under /public/assets and hand back a
// same-origin URL — the same contract as openaiTTS.
//
// Pass 36: all `client().audio.speech()` calls go through the
// `speechify` rate limiter (counting semaphore, default capacity = 1)
// so concurrent requests beyond the plan limit queue up instead of
// 429-ing with `concurrency_limit_reached`. The free Speechify plan
// only allows 1 simultaneous request; this serializer keeps the
// orchestrator's "fire 5 in parallel" pattern from exceeding that.

import { SpeechifyClient } from "@speechify/api";
import { limiters } from "./rateLimiter";
import { retryWithBackoff } from "./retry";

export interface SpeechifyTtsResult {
  /** Public URL the browser can fetch (mirrored from Speechify's response). */
  url: string;
  /** Provider / model / voice actually used, for the debug log. */
  model: string;
  voice: string;
  durationMs?: number;
}

// Map the studio's creative voice tones onto Speechify voice ids that are
// available on the shared plan (verified against GET /v1/voices for the
// default workspace). These English voices all use Simba 3.0. Pin a
// specific voice per-voice with SPEECHIFY_VOICE when you have a preferred id.
const VOICE_MAP: Record<string, string> = {
  warm: "alicia",
  energetic: "alec",
  authoritative: "alton",
  calm: "alfonso",
  playful: "amon",
};

let cached: SpeechifyClient | null = null;

/** Lazily builds (and caches) the Speechify client. */
function client(): SpeechifyClient {
  if (!cached) {
    if (!process.env.SPEECHIFY_API_KEY) {
      throw new Error("SPEECHIFY_API_KEY is not set");
    }
    cached = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });
  }
  return cached;
}

/**
 * Synthesizes speech with Speechify via client.audio.speech().
 *
 * Returns the audio as Base64 JSON (GetSpeechResponse.audio_data), which we
 * decode and persist. Exact duration comes from speech_marks.end_time.
 *
 * Concurrency is gated through the `speechify` rate limiter so calls
 * beyond the plan's concurrent-request limit queue up rather than
 * 429-ing. We also retry on transient 429/5xx (3 attempts, exp backoff)
 * so a brief capacity blip doesn't fail the orchestrator's TTS phase.
 */
export async function speechifyTTS(
  text: string,
  tone: string = "warm"
): Promise<SpeechifyTtsResult> {
  const { persistAsset } = await import("./http");

  const voice =
    process.env.SPEECHIFY_VOICE ||
    process.env.SPEECHIFY_TTS_VOICE ||
    VOICE_MAP[tone] ||
    "alicia";
  // The SDK types `model` as a literal union. `SPEECHIFY_MODEL` lets the
  // operator switch models (e.g. simba-3.0 for multilingual) without a code
  // change, so we cast the resolved string to the SDK's model type.
  const model = (process.env.SPEECHIFY_MODEL || "simba-3.0") as
    | "simba-3.0"
    | "simba-3.2"
    | "simba-english"
    | "simba-multilingual";

  // Pass 36: route the SDK call through the rate limiter so concurrent
  // requests beyond the Speechify plan's limit queue up (capacity=1
  // by default; tune via SPEECHIFY_CONCURRENCY env). Also retry with
  // exponential backoff in case a queued call still hits a 429 — that
  // indicates the upstream limit was breached between permit
  // acquisition and the actual request, which retry absorbs cleanly.
  const response = await limiters.speechify.run(() =>
    retryWithBackoff(
      () =>
        client().audio.speech({
          input: text,
          voice_id: voice,
          model,
          audio_format: "mp3",
        }),
      { retries: 4, baseMs: 1500, maxMs: 12000 },
    ),
  );

  const audioB64 = response.audio_data;
  if (!audioB64) {
    throw new Error("Speechify TTS returned no audio_data");
  }

  const buf = Buffer.from(audioB64, "base64");
  const url = await persistAsset(buf, {
    ext: "mp3",
    prefix: "tts",
    contentType: "audio/mpeg",
  });

  // End-to-end duration in ms from the speech marks, when present — far more
  // accurate than a byte-rate estimate.
  const durationMs =
    typeof response.speech_marks?.end_time === "number"
      ? Math.round(response.speech_marks.end_time)
      : Math.round((buf.length * 8) / 128);

  return { url, model, voice, durationMs };
}
