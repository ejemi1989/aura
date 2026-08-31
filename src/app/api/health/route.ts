// Server-side provider capability report. The client polls this once on
// load to know which providers are configured, so the UI can show a
// clear "DEMO MODE" badge instead of pretending every asset is real.

import { NextResponse } from "next/server";
import {
  imageProvider,
  textToSpeechProvider,
  textToVideoProvider,
  imageToVideoProvider,
  hasOpenAI,
  demoModeAllowed,
} from "@/lib/providers/config";

export const runtime = "nodejs";

export async function GET() {
  const image = imageProvider();
  const tts = textToSpeechProvider();
  const t2v = textToVideoProvider();
  const i2v = imageToVideoProvider();
  const llm = hasOpenAI();
  const demo = demoModeAllowed();

  const capabilities = {
    image: { provider: image.name, available: image.available, reason: image.reason },
    textToSpeech: { provider: tts.name, available: tts.available, reason: tts.reason },
    textToVideo: { provider: t2v.name, available: t2v.available, reason: t2v.reason },
    imageToVideo: { provider: i2v.name, available: i2v.available, reason: i2v.reason },
    llm: { provider: llm ? "openai" : "demo", available: llm },
  };

  const demoMode =
    !image.available || !tts.available || !t2v.available || !i2v.available || !llm;

  // Storage backends — distinct from generation providers. R2 and
  // Supabase have separate env keys so the client can render the
  // actual backend (active vs local-disk fallback) instead of inferring
  // it from generation keys.
  const r2 = {
    configured: !!(
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    ),
    bucket: process.env.R2_BUCKET ?? null,
    publicUrl: process.env.R2_PUBLIC_URL ?? null,
  };
  const supabase = {
    configured: !!(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SECRET_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SERVICE_ROLE)
    ),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null,
  };

  return NextResponse.json(
    {
      mode: demoMode ? "demo" : "live",
      demoMode,
      demoAllowed: demo,
      capabilities,
      r2,
      supabase,
      ffmpegAvailable: await checkFfmpeg(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

async function checkFfmpeg(): Promise<boolean> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  try {
    await exec("ffmpeg", ["-version"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
