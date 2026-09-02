import type { Project, Scene } from "@/types";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// ---------------------------------------------------------------------------
// Client-side export of the finished video.
//
// Three paths, mirroring how the compose endpoint behaves:
//
//   • Real mp4 — composedVideoUrl points at /assets/ on ffmpeg hosts:
//     just stream-download the file.
//
//   • WebCodecs MP4 — when the browser supports h264 VideoEncoder +
//     AAC AudioEncoder (Chrome 94+, Safari 16.4+, Edge): encode a real
//     standalone MP4 from the per-scene stills entirely in-browser with
//     zero server dependencies.
//
//   • MediaRecorder fallback — when WebCodecs h264/aac isn't available:
//     stitches stills/clips via canvas capture and emits mp4
//     (Safari/Chrome) or webm (Firefox).
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
 * Download a URL as a file via a temporary anchor.
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Client-side stitch of a manifest (slideshow) into a downloadable video.
 *
 * Prefers the WebCodecs path for a true MP4, then falls back to
 * MediaRecorder (webm or browser-native mp4) where WebCodecs is
 * unsupported.
 */
export async function exportManifestAsVideo(
  project: Project,
  opts: { onProgress?: (fraction: number) => void } = {}
): Promise<ExportOutcome> {
  const scenes = project.scenes.filter((s) => s.videoUrl || s.imageUrl);
  if (scenes.length === 0) {
    return {
      ok: false,
      mode: "none",
      message: "No scene clips to export.",
      filename: sanitizeFilename(project.name),
    };
  }

  // Prefer WebCodecs h264/aac → true MP4 when the browser supports it.
  if (canEncodeWebCodecsMp4()) {
    try {
      return await encodeWebCodecsMp4(project, scenes, opts.onProgress);
    } catch (err) {
      // Fall through to MediaRecorder on any encode error.
      console.warn("WebCodecs MP4 encode failed, using MediaRecorder fallback", err);
    }
  }

  return encodeMediaRecorderFallback(project, scenes, opts.onProgress);
}

// ---------------------------------------------------------------------------
// WebCodecs h264 + AAC → true MP4
// ---------------------------------------------------------------------------

function canEncodeWebCodecsMp4(): boolean {
  try {
    const w: any = window;
    return (
      typeof w.VideoEncoder === "function" &&
      typeof w.AudioEncoder === "function" &&
      typeof w.VideoFrame === "function" &&
      typeof w.AudioData === "function"
    );
  } catch {
    return false;
  }
}

async function encodeWebCodecsMp4(
  project: Project,
  scenes: Scene[],
  onProgress?: (fraction: number) => void
): Promise<ExportOutcome> {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 30;
  const MICRO = 1_000_000;
  const frameDurUs = Math.round(MICRO / FPS);

  // ── Video frames: draw still images at 30 fps ──────────────────────────
  const durations = scenes.map((s) => Math.max(1, s.durationSeconds ?? 4));
  const srcImages = await Promise.all(
    scenes.map((s) => loadImage(s.imageUrl || s.videoUrl!))
  );

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");

  const w: any = window;

  let videoError: unknown = null;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: WIDTH, height: HEIGHT },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  const videoEncoder = new w.VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: unknown) => {
      videoError ??= e;
    },
  });

  // Baseline L3.0 — broadly supported h264 profile.
  videoEncoder.configure({
    codec: "avc1.42001f",
    width: WIDTH,
    height: HEIGHT,
    bitrate: 6_000_000,
    framerate: FPS,
    latencyMode: "realtime",
  });

  let runningUs = 0;

  for (let i = 0; i < scenes.length; i++) {
    const img = srcImages[i];
    const frameCount = Math.round(durations[i] * FPS);

    for (let f = 0; f < frameCount; f++) {
      drawStill(ctx, img, WIDTH, HEIGHT, scenes[i].caption);
      const timestamp = runningUs + f * frameDurUs;
      const frame = new w.VideoFrame(canvas, { timestamp, duration: frameDurUs });
      videoEncoder.encode(frame, { keyFrame: f === 0 });
      frame.close();
    }
    runningUs += frameCount * frameDurUs;
    onProgress?.((i + 1) / scenes.length);
  }

  await videoEncoder.flush();
  if (videoError) throw videoError;

  // ── Audio: decode per-scene narration WAVs → AAC mono 22050 ────────────
  const sampleRate = 22050;
  const totalDur = durations.reduce((a, b) => a + b, 0);
  const hasAudio = scenes.some((s) => s.voiceoverUrl);
  if (hasAudio) {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    }) as AudioContext;
    const totalSamples = Math.round(totalDur * sampleRate);
    const pcm = new Float32Array(totalSamples);
    let cursor = 0;

    for (let i = 0; i < scenes.length; i++) {
      const dur = durations[i];
      if (scenes[i].voiceoverUrl) {
        try {
          const res = await fetch(scenes[i].voiceoverUrl!);
          const ab = await res.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(ab);
          const ch0 = decoded.getChannelData(0);
          const fit = Math.min(ch0.length, Math.round(dur * sampleRate));
          pcm.set(ch0.subarray(0, fit), cursor);
        } catch {
          /* skip broken audio */
        }
      }
      cursor += Math.round(dur * sampleRate);
    }
    await audioCtx.close();

    let audioError: unknown = null;
    const audioEncoder = new w.AudioEncoder({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: unknown) => {
        audioError ??= e;
      },
    });

    // AAC-LC mono 22050 — widely supported.
    audioEncoder.configure({
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels: 1,
      bitrate: 128_000,
    });

    // Encode in 1024-sample AAC frames (padding zeros for the tail).
    const chunkSize = 1024;
    const numChunks = Math.ceil(pcm.length / chunkSize);
    for (let c = 0; c < numChunks; c++) {
      const start = c * chunkSize;
      const len = Math.min(chunkSize, pcm.length - start);
      const buf = new Float32Array(chunkSize);
      buf.set(pcm.subarray(start, start + len));
      const ad = new w.AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfChannels: 1,
        numberOfFrames: chunkSize,
        timestamp: Math.round((start / sampleRate) * MICRO),
        data: buf.buffer,
      });
      audioEncoder.encode(ad);
      ad.close();
    }

    await audioEncoder.flush();
    if (audioError) throw audioError;
  }

  muxer.finalize();
  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  const blob = new Blob([buffer], { type: "video/mp4" });
  if (blob.size === 0) {
    return {
      ok: false,
      mode: "none",
      message: "WebCodecs produced an empty file.",
      filename: sanitizeFilename(project.name),
    };
  }

  triggerDownload(blob, `${sanitizeFilename(project.name)}.mp4`);
  return {
    ok: true,
    mode: "mp4",
    message: "Exported MP4 (browser-encoded, no server required).",
    filename: sanitizeFilename(project.name),
  };
}

// ---------------------------------------------------------------------------
// MediaRecorder fallback (canvas capture, handles both stills + clips)
// ---------------------------------------------------------------------------

async function encodeMediaRecorderFallback(
  project: Project,
  scenes: Scene[],
  onProgress?: (fraction: number) => void
): Promise<ExportOutcome> {
  const mime = pickMediaRecorderMime();
  const extension = mime.includes("mp4") ? "mp4" : "webm";
  const WIDTH = 1280;
  const HEIGHT = 720;

  // Preload every scene: image or video element.
  const loaded = await Promise.all(
    scenes.map(async (s) => {
      const src = s.videoUrl || s.imageUrl;
      if (!src || src === "__no_video__") return { kind: "none" as const };
      if (isVideoUrl(src)) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.src = src;
        await waitForLoaded(video);
        return { kind: "video" as const, video };
      }
      return { kind: "image" as const, img: await loadImage(src) };
    })
  );

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      ok: false,
      mode: "none",
      message: "Canvas 2D not available.",
      filename: sanitizeFilename(project.name),
    };
  }

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

    recorder.start(250);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const dur = Math.max(1, scene.durationSeconds ?? 4);
      const src = loaded[i];
      onProgress?.((i + 1) / scenes.length);

      if (src.kind === "video") {
        await paintVideoScene(ctx, src.video, WIDTH, HEIGHT, scene.caption, dur);
      } else {
        await paintStillScene(
          ctx,
          src.kind === "image" ? src.img : null,
          WIDTH,
          HEIGHT,
          scene.caption,
          dur
        );
      }
    }

    recorder.stop();
    await done;
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
      mode: extension === "mp4" ? "mp4" : "webm",
      message:
        extension === "mp4"
          ? "Exported MP4 (MediaRecorder)."
          : "This browser can't encode mp4 — exported WebM instead. Install ffmpeg on the server for guaranteed MP4.",
      filename: sanitizeFilename(project.name),
    };
  } catch (err) {
    return {
      ok: false,
      mode: "none",
      message: err instanceof Error ? err.message : "Export failed.",
      filename: sanitizeFilename(project.name),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawStill(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  caption?: string
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (img && img.complete && img.naturalWidth > 0) {
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
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

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  caption?: string
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (video.videoWidth > 0 && video.videoHeight > 0) {
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

async function paintVideoScene(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  caption: string | undefined,
  seconds: number
): Promise<void> {
  return new Promise((resolve) => {
    const end = performance.now() + seconds * 1000;
    video.currentTime = 0;
    video.play().catch(() => {});
    const tick = (now: number) => {
      drawVideoFrame(ctx, video, width, height, caption);
      if (now < end) requestAnimationFrame(tick);
      else {
        video.pause();
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

async function paintStillScene(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  width: number,
  height: number,
  caption: string | undefined,
  seconds: number
): Promise<void> {
  return new Promise((resolve) => {
    const end = performance.now() + seconds * 1000;
    const tick = (now: number) => {
      drawStill(ctx, img!, width, height, caption);
      if (now < end) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

function isVideoUrl(url: string): boolean {
  if (url.startsWith("data:video/")) return true;
  if (/\.mp4(\?|$)/i.test(url)) return true;
  if (/\.webm(\?|$)/i.test(url)) return true;
  return false;
}

function pickMediaRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm;codecs=vp8,opus";
  if (
    MediaRecorder.isTypeSupported("video/mp4") ||
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
  ) {
    return "video/mp4";
  }
  return "video/webm;codecs=vp8,opus";
}

function waitForLoaded(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("Video clip failed to load.")),
      { once: true }
    );
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "creative-studio-export";
}
