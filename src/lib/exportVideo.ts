import type { Project } from "@/types";

// ---------------------------------------------------------------------------
// Client-side export of the finished video.
//
// Two cases, mirroring how the compose endpoint behaves:
//
//   • Real mp4 — `composedVideoUrl` points at `/assets/composed_*.mp4` on
//     drives with ffmpeg installed. We just stream it back to the user.
//
//   • Manifest (slideshow) — ffmpeg isn't on the server, so there's no
//     single .mp4 to grab. Here we stitch the per-scene clips in the
//     browser: play each clip once into a MediaRecorder and emit a
//     concatenated file. We request `video/mp4` first (supported by
//     Safari and recent Chromium), falling back to `video/webm` where the
//     encoder is unavailable.
// ---------------------------------------------------------------------------

export interface ExportOutcome {
  ok: boolean;
  mode: "mp4" | "webm" | "none";
  /** Human-readable message describing what was produced / why not. */
  message: string;
  /** Filename the user should see for the download (without extension). */
  filename: string;
}

/**
 * Determines whether a real, downloadable mp4 exists for this project.
 */
export function hasDownloadableMp4(project: Project): boolean {
  const url = project.composedVideoUrl;
  return !!url && url !== "__manifest__" && url !== "";
}

/**
 * Download a URL as a file via a temporary anchor. Works with `/assets/...`
 * and remote URLs (cross-origin fetch must succeed).
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click registers before cleanup.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Client-side stitch of a manifest (slideshow) into a downloadable video
 * using MediaRecorder. Returns the outcome; the download is triggered here.
 *
 * How this avoids the "no tracks" MediaRecorder failure: we never attach a
 * MediaRecorder to a `<video>` element's captureStream() (which has no
 * tracks until media decodes). Instead we render every frame onto a hidden
 * `<canvas>` and capture that canvas — a canvas captureStream() is backed
 * by a real video track from the moment it's created. Each scene clip is
 * loaded into a hidden `<video>`, drawn to the canvas with drawImage on a
 * requestAnimationFrame loop for its duration, then we advance to the next
 * clip.
 *
 * Ties into `onProgress` (0..1) so the UI can show an in-progress state.
 */
export async function exportManifestAsVideo(
  project: Project,
  opts: { onProgress?: (fraction: number) => void } = {}
): Promise<ExportOutcome> {
  const { onProgress } = opts;
  const scenes = project.scenes.filter((s) => s.videoUrl);
  if (scenes.length === 0) {
    return {
      ok: false,
      mode: "none",
      message: "No scene clips to export.",
      filename: sanitizeFilename(project.name),
    };
  }

  const isMp4Capable = pickRecorderMime();
  const mime = isMp4Capable ? "video/mp4" : "video/webm;codecs=vp8,opus";
  const extension = isMp4Capable ? "mp4" : "webm";

  const WIDTH = 1280;
  const HEIGHT = 720;

  // Hidden source <video> each clip is decoded into. Must be in the DOM
  // (not display:none — use off-screen positioning) for reliable decoding.
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  video.style.width = `${WIDTH}px`;
  video.style.height = `${HEIGHT}px`;
  document.body.appendChild(video);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    video.remove();
    return {
      ok: false,
      mode: "none",
      message: "Canvas 2D context unavailable.",
      filename: sanitizeFilename(project.name),
    };
  }

  // Capture the canvas — this stream ALWAYS carries a video track, which is
  // the prerequisite for MediaRecorder.start() to succeed.
  const stream = canvas.captureStream(30);

  try {
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Recording failed."));
    });

    // Give the recorder a good warm-up before we start painting frames.
    recorder.start(250);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const dur = Math.max(1, scene.durationSeconds ?? 4);
      onProgress?.(i / scenes.length);

      video.src = scene.videoUrl!;
      await waitForLoaded(video);
      video.currentTime = 0;
      await video.play().catch(() => {});

      // Paint each frame of this clip onto the canvas for `dur` seconds.
      await playSceneIntoCanvas(ctx, video, WIDTH, HEIGHT, scene.caption, dur);
    }

    recorder.stop();
    await done;
    onProgress?.(1);
    video.remove();

    const blob = new Blob(chunks, { type: mime });
    if (blob.size === 0) {
      return {
        ok: false,
        mode: "none",
        message: "Recording produced an empty file.",
        filename: sanitizeFilename(project.name),
      };
    }
    triggerDownload(blob, `${sanitizeFilename(project.name)}.${extension}`);
    return {
      ok: true,
      mode: isMp4Capable ? "mp4" : "webm",
      message: isMp4Capable
        ? "Exported MP4 (stitched in browser)."
        : "This browser can't write mp4 — exported WebM instead. Install ffmpeg on the server for true MP4.",
      filename: sanitizeFilename(project.name),
    };
  } catch (err) {
    video.remove();
    return {
      ok: false,
      mode: "none",
      message: err instanceof Error ? err.message : "Export failed.",
      filename: sanitizeFilename(project.name),
    };
  }
}

// Plays a single clip into the canvas for `seconds`, drawing a frame every
// animation tick. Resolves once the clip's window has elapsed.
function playSceneIntoCanvas(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  caption: string | undefined,
  seconds: number
): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const end = started + seconds * 1000;
    const paint = (now: number) => {
      drawSceneFrame(ctx, video, width, height, caption);
      if (now < end) {
        requestAnimationFrame(paint);
      } else {
        video.pause();
        resolve();
      }
    };
    requestAnimationFrame(paint);
  });
}

// Draws the current video frame (plus optional caption) onto the canvas.
function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  caption?: string
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    // Cover-fit the frame, preserving aspect ratio.
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }
  if (caption) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, height - 64, width, 64);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const line = caption.length > 60 ? caption.slice(0, 57) + "…" : caption;
    ctx.fillText(line, width / 2, height - 32);
  }
}

function pickRecorderMime(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return (
    MediaRecorder.isTypeSupported("video/mp4") ||
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
  );
}

function waitForLoaded(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Video clip failed to load.")), {
      once: true,
    });
  });
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "creative-studio-export";
}
