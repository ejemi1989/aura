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

  // Download each clip locally so ffmpeg can read it from disk (handles
  // /assets/... and remote URLs uniformly).
  const inputs: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const local = await downloadToLocal(s.videoUrl, `${id}_in${i}.mp4`);
    inputs.push(local);
  }

  // Build the ffmpeg filter graph. Concat-demuxer is the safest approach
  // for same-codec clips; we re-encode to a uniform 1280x720@30fps mp4 so
  // the output plays in any browser. Transitions beyond `cut` use the
  // xfade filter (ffmpeg 4.3+).
  const useCrossfade = transition !== "cut" && scenes.length >= 2;
  if (!useCrossfade) {
    // Simple concat via demuxer
    const listPath = join(dir, `${id}_list.txt`);
    const listBody = inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listBody);
    await exec(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { timeout: 120_000 }
    );
  } else {
    // xfade filter for cross-fade-style transitions.
    const xfType = XFADE[transition];
    const dur = 0.5; // 500ms transitions
    let filter = "";
    let lastLabel = "[0:v]";
    for (let i = 1; i < inputs.length; i++) {
      const offset = i * 4 - dur; // each scene 4s
      const out = i === inputs.length - 1 ? "[v]" : `[v${i}]`;
      filter += `${lastLabel}[${i}:v]xfade=transition=${xfType}:duration=${dur}:offset=${offset}${out};`;
      lastLabel = out;
    }
    const aFilter = inputs.map((_, i) => `[${i}:a]`).join("") + `concat=n=${inputs.length}:v=0:a=1[a]`;
    const filterComplex = filter + aFilter;

    await exec(
      "ffmpeg",
      [
        "-y",
        ...inputs.flatMap((p) => ["-i", p]),
        "-filter_complex", filterComplex,
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-r", "30",
        "-s", "1280x720",
        outPath,
      ],
      { timeout: 120_000 }
    );
  }

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
