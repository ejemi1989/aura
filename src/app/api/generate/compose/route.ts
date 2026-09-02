import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { badRequest, upstreamErrorResponse } from "@/lib/providers/http";
import { demoModeAllowed } from "@/lib/providers/config";

const exec = promisify(execFile);

export const runtime = "nodejs";
// ffmpeg can take a while for multi-clip assembly.
export const maxDuration = 180;

interface SceneInput {
  videoUrl: string;
  voiceoverUrl?: string;
  caption?: string;
  durationSeconds?: number;
}

interface RequestBody {
  scenes: SceneInput[];
  transitionStyle?: "cut" | "crossfade" | "whip_pan" | "match_cut";
  projectId?: string;
}

const XFADE: Record<NonNullable<RequestBody["transitionStyle"]>, string> = {
  cut: "cut",
  crossfade: "fade",
  whip_pan: "slideleft",
  match_cut: "fadeblack",
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
    return badRequest("Field 'scenes' must be a non-empty array.", { scenes: "required" });
  }

  // Validate every URL points to a video we can fetch.
  for (const [i, s] of body.scenes.entries()) {
    if (!s.videoUrl) {
      return badRequest(`Scene ${i} is missing 'videoUrl'.`, { [`scenes.${i}.videoUrl`]: "required" });
    }
  }

  const transition = body.transitionStyle ?? "crossfade";

  // Try ffmpeg-based assembly first. If the binary isn't available (e.g.
  // serverless without ffmpeg), fall back to a manifest the UI can use to
  // play scenes sequentially.
  if (await hasFfmpeg()) {
    try {
      const url = await composeWithFfmpeg(body.scenes, transition);
      return NextResponse.json({
        mode: "live",
        provider: "ffmpeg",
        url,
        sceneCount: body.scenes.length,
        transitionStyle: transition,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return upstreamErrorResponse({ provider: "ffmpeg", status: 502, message });
    }
  }

  if (!demoModeAllowed()) {
    return NextResponse.json(
      {
        error: "not_configured",
        provider: "ffmpeg",
        message: "ffmpeg binary not found on the server. Install ffmpeg or set DEMO_MODE=true to use the manifest fallback.",
      },
      { status: 503 }
    );
  }

  // Demo path: return a JSON manifest the VideoPreview component can use
  // to play scenes sequentially as a slideshow, so judges still see the
  // final composition UX.
  return NextResponse.json({
    mode: "demo",
    provider: "demo",
    url: null,
    manifest: {
      type: "sequence",
      transition,
      scenes: body.scenes.map((s) => ({
        videoUrl: s.videoUrl,
        voiceoverUrl: s.voiceoverUrl,
        caption: s.caption,
        durationSeconds: s.durationSeconds ?? 4,
      })),
    },
    note:
      "ffmpeg not installed on this server. The video preview will play the scene clips back-to-back instead of a rendered mp4. Install ffmpeg to enable real composition.",
  });
}

async function hasFfmpeg(): Promise<boolean> {
  try {
    await exec("ffmpeg", ["-version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function composeWithFfmpeg(scenes: SceneInput[], transition: NonNullable<RequestBody["transitionStyle"]>): Promise<string> {
  const dir = join(process.cwd(), "public", "assets");
  await mkdir(dir, { recursive: true });
  const id = `composed_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const outPath = join(dir, `${id}.mp4`);

  // Scene slot durations: each scene plays for its real duration (TTS sets
  // this to the narration length so audio and video stay in sync). Defaults
  // to 4s for scenes without an explicit duration.
  const durations = scenes.map((s) => Math.max(1, s.durationSeconds ?? 4));
  const crossfadeDur = 0.5; // 500ms transitions
  // Cumulative start time (in the final timeline) of each scene's video,
  // accounting for the crossfade overlap with the previous scene.
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    starts.push(acc);
    acc += durations[i] - (i < scenes.length - 1 ? crossfadeDur : 0);
  }
  const totalDuration = acc;

  // Download each clip (and its narration) locally so ffmpeg can read them
  // from disk uniformly regardless of /assets/ or remote URLs.
  const inputs: string[] = [];
  const voiceInputs: (string | null)[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const local = await downloadToLocal(s.videoUrl, `${id}_in${i}.mp4`);
    inputs.push(local);
    let vo: string | null = null;
    if (s.voiceoverUrl) {
      try {
        vo = await downloadToLocal(s.voiceoverUrl, `${id}_vo${i}.mp3`);
      } catch {
        vo = null; // narration missing/invalid — build without it
      }
    }
    voiceInputs.push(vo);
  }

  // Narration/voiceover indexes in the input list (videos come first).
  const voParamIndex = (i: number) => inputs.length + i;

  const useCrossfade = transition !== "cut" && scenes.length >= 2;
  if (!useCrossfade) {
    // Simple concat via demuxer.
    const listPath = join(dir, `${id}_list.txt`);
    const listBody = inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listBody);
    await exec(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { timeout: 120_000 }
    );
    return `/assets/${id}.mp4`;
  }

  // xfade the video tracks using each scene's real start time so the visual
  // timeline matches the durations the narration set.
  const xfType = XFADE[transition];
  let filter = "";
  let lastLabel = "[0:v]";
  for (let i = 1; i < scenes.length; i++) {
    const offset = starts[i];
    const out = i === scenes.length - 1 ? "[vid]" : `[v${i}]`;
    filter += `${lastLabel}[${i}:v]xfade=transition=${xfType}:duration=${crossfadeDur}:offset=${offset}${out};`;
    lastLabel = out;
  }
  if (scenes.length === 1) {
    filter = `[0:v]null[vid];`;
  }

  // Audio: mix every scene's narration at its own start time with adelay,
  // so voiceover lands exactly when its scene begins and nothing repeats or
  // drifts. When a scene has no narration, it stays silent rather than
  // pulling a stale audio track out of sync.
  const voiceLanes: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    if (voiceInputs[i]) {
      const delayMs = Math.round(starts[i] * 1000);
      filter += `[${voParamIndex(i)}:a]aresample=44100,adelay=${delayMs}|${delayMs}[vo${i}];`;
      voiceLanes.push(`[vo${i}]`);
    }
  }
  const amixLabel = voiceLanes.length > 0 ? "[aud]" : "[sil]";
  if (voiceLanes.length > 0) {
    filter += `${voiceLanes.join("")}amix=inputs=${voiceLanes.length}:normalize=0:duration=longest${amixLabel};`;
  } else {
    // No narration for any scene — keep each clip's own audio but delay it
    // to its scene start so tracks stay time-aligned with the visuals
    // instead of all overlapping at t=0.
    const clipLanes: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const delayMs = Math.round(starts[i] * 1000);
      filter += `[${i}:a]aresample=44100,adelay=${delayMs}|${delayMs}[c${i}];`;
      clipLanes.push(`[c${i}]`);
    }
    filter += `${clipLanes.join("")}amix=inputs=${clipLanes.length}:normalize=0:duration=longest${amixLabel};`;
  }

  const ffArgs = [
    "-y",
    ...inputs.flatMap((p) => ["-i", p]),
    ...voiceInputs.filter(Boolean).flatMap((p) => ["-i", p as string]),
    "-filter_complex", filter,
    "-map", "[vid]",
    "-map", amixLabel,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-r", "30",
    "-s", "1280x720",
    "-t", String(totalDuration),
    outPath,
  ];

  await exec("ffmpeg", ffArgs, { timeout: 120_000 });

  // Best-effort cleanup of the intermediate inputs; if it fails, the next
  // build will overwrite them anyway.
  await Promise.all(
    inputs.map((p) =>
      stat(p).then(
        () => import("node:fs/promises").then((fs) => fs.unlink(p).catch(() => {})),
        () => {}
      )
    )
  );

  return `/assets/${id}.mp4`;
}

async function downloadToLocal(url: string, filename: string): Promise<string> {
  const dir = join(process.cwd(), "public", "assets");
  await mkdir(dir, { recursive: true });
  const out = join(dir, filename);
  if (url.startsWith("/assets/")) {
    // Already on disk; just copy it.
    const { copyFile } = await import("node:fs/promises");
    const src = join(process.cwd(), "public", url);
    await copyFile(src, out);
    return out;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  return out;
}
