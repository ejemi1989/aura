import { NextRequest, NextResponse } from "next/server";
import { textToSpeechProvider, demoModeAllowed } from "@/lib/providers/config";
import { openaiTTS } from "@/lib/providers/openai";
import { speechifyTTS } from "@/lib/providers/speechify";
import { badRequest, notConfigured, upstreamErrorResponse } from "@/lib/providers/http";
import { renderDemoTone, newAssetId } from "@/lib/providers/demoAssets";
import { limiters } from "@/lib/providers/rateLimiter";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RequestBody {
  text: string;
  voiceTone?: "warm" | "energetic" | "authoritative" | "calm" | "playful" | string;
}

/**
 * Pass 36: detect Speechify's `concurrency_limit_reached` error and
 * turn it into a 503 with actionable detail (queue position + retry
 * hint) instead of a generic 502. The message names the exact
 * permission the user needs to upgrade and the env var that controls
 * the studio's per-process cap.
 */
function annotateSpeechifyError(err: unknown): { status: number; message: string; details: Record<string, unknown> } {
  const raw = err instanceof Error ? err.message : String(err);
  const isConcurrency =
    /concurrency_limit_reached|concurrent request|too many simultaneous/i.test(raw);

  if (!isConcurrency) {
    return { status: 502, message: raw, details: {} };
  }

  return {
    status: 503,
    message:
      "Speechify rate limit hit: this Speechify plan only allows " +
      "1 simultaneous request and another TTS call was already in flight. " +
      "The studio's per-process semaphore (capacity = 1) should have " +
      "queued this call instead, so a 503 means a parallel caller " +
      "bypassed the limiter — verify `runInParallel` concurrency is " +
      "1 for the voiceover agent. To raise the cap, upgrade the " +
      "Speechify plan and set `SPEECHIFY_CONCURRENCY=2` (or higher) " +
      "in `.env`. Otherwise wait a few seconds and retry.",
    details: {
      provider: "speechify",
      activeInSemaphore: limiters.speechify.active,
      pendingInQueue: limiters.speechify.pending,
      capacity: limiters.speechify.capacity,
      served: limiters.speechify.served,
    },
  };
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!body.text || typeof body.text !== "string" || body.text.trim().length < 1) {
    return badRequest("Field 'text' is required.", { text: "required" });
  }

  const provider = textToSpeechProvider();

  if (provider.name === "openai") {
    try {
      const result = await openaiTTS(body.text, body.voiceTone ?? "warm");
      return NextResponse.json({
        mode: "live",
        provider: "openai",
        url: result.url,
        model: result.model,
        voice: result.voice,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return upstreamErrorResponse({ provider: "openai", status: 502, message });
    }
  }

  if (provider.name === "speechify") {
    try {
      const result = await speechifyTTS(body.text, body.voiceTone ?? "warm");
      return NextResponse.json({
        mode: "live",
        provider: "speechify",
        url: result.url,
        model: result.model,
        voice: result.voice,
        durationMs: result.durationMs,
      });
    } catch (err) {
      const annotated = annotateSpeechifyError(err);
      return NextResponse.json(
        {
          error: annotated.message,
          provider: "speechify",
          mode: "error",
          ...annotated.details,
        },
        { status: annotated.status },
      );
    }
  }

  if (!demoModeAllowed()) {
    return notConfigured(provider.name, "text-to-speech");
  }

  // Demo path: real WAV whose pitch + melody is derived from the scene's
  // actual narration text, so each scene gets a perceptibly distinct
  // demo tone (not all scenes sharing one voice tone).
  const id = newAssetId("tts");
  const { url, durationMs } = await renderDemoTone(
    id,
    body.voiceTone ?? "warm",
    body.text,
  );
  return NextResponse.json({
    mode: "demo",
    provider: "demo",
    url,
    model: "demo-tone",
    voice: body.voiceTone ?? "warm",
    durationMs,
    note:
      "Demo mode — generated a real WAV whose pitch + melody is keyed " +
      "to the scene's narration so each scene sounds distinct. Set " +
      "SPEECHIFY_API_KEY (primary) for Speechify voices, or OPENAI_API_KEY " +
      "for gpt-4o-mini-tts. Set DEMO_MODE=false to disable placeholders.",
  });
}
