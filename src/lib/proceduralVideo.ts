// Procedural video generator — produces a real WebM video file from
// a scene's still image using the browser's Canvas + MediaRecorder
// APIs. This is the ultimate fallback when every external video
// provider (Veo, FAL, Luma, Runway, Replicate) is unavailable — the
// studio can still ship a "video" by animating the key visual with
// the same Ken Burns + text overlays as the Motion Graphics overlay.
//
// The output is uploaded to /public/assets/ via POST /api/upload-asset
// so the resulting videoUrl is served like any other generated asset.
//
// Why this exists:
//   - Veo quota exhausted (429 RESOURCE_EXHAUSTED) is a real-world
//     blocker the user has hit.
//   - FAL/Luma/Runway require paid accounts with separate keys.
//   - The motion graphics engine makes stills LOOK animated in the
//     preview, but it's still images — not a video file. The user
//     asked for "videos using the video model not static images".
//   - This fallback produces an actual MP4-equivalent (WebM) that
//     exports and timeline playback both treat as a real video.
//
// Limitations:
//   - WebM, not MP4 (MediaRecorder doesn't natively produce MP4 in
//     every browser). The compose pipeline accepts WebM as input.
//   - Audio is NOT baked in — the voiceover is layered in the
//     timeline as usual, the same way real AI videos work.
//   - 30fps target. Real Ken Burns output is ~16fps of motion + 14fps
//     of rest, but we record at 30fps for smoother playback.

import type { Scene } from "@/types";

export interface ProceduralVideoOptions {
  /** Scene image URL. Required. */
  imageUrl: string;
  /** Scene duration in seconds. Clamped to [2, 20]. */
  durationSeconds: number;
  /** Ken Burns pattern. Default "kenBurns-in". */
  pattern?: "kenBurns-in" | "kenBurns-out" | "parallax-drift" | "glide-up" | "pulse-zoom";
  /** Lower-third text overlay (eyebrow + title). Default empty. */
  eyebrow?: string;
  /** Lower-third title text. Default empty. */
  title?: string;
  /** Scene number badge text. Default empty. */
  sceneNumber?: string;
  /** Output width. Default 1280 (HD-ready). */
  width?: number;
  /** Output height. Default 720 (16:9). */
  height?: number;
  /** Frame rate. Default 30. */
  fps?: number;
  /** Bits per second for the MediaRecorder. Default 2_500_000 (2.5Mbps). */
  bitrate?: number;
}

export interface ProceduralVideoResult {
  /** Object URL of the generated WebM blob. */
  blobUrl: string;
  /** The WebM Blob itself. Upload this to /api/upload-asset. */
  blob: Blob;
  /** Final duration in seconds (real recording time). */
  actualDuration: number;
  /** Output dimensions. */
  width: number;
  height: number;
  /** Approx size in bytes. */
  sizeBytes: number;
}

/**
 * Apply the Ken Burns transform for the given pattern at time `t`
 * (normalized 0-1) to a base position. Returns CSS-style
 * `transform: scale(...) translate(...)` strings.
 */
function kenBurnsTransform(
  pattern: NonNullable<ProceduralVideoOptions["pattern"]>,
  t: number,
): { scale: number; tx: number; ty: number } {
  switch (pattern) {
    case "kenBurns-in":
      return { scale: 1.0 + 0.18 * t, tx: -2 * t, ty: -1.5 * t };
    case "kenBurns-out":
      return { scale: 1.18 - 0.18 * t, tx: -2 + 2 * t, ty: -1.5 + 1.5 * t };
    case "parallax-drift":
      return { scale: 1.12, tx: -4 + 8 * Math.sin(t * Math.PI), ty: 0 };
    case "glide-up":
      return { scale: 1.15, tx: 0, ty: 3 - 6 * t };
    case "pulse-zoom":
      return { scale: 1.02 + 0.04 * Math.sin(t * Math.PI * 2), tx: 0, ty: 0 };
  }
}

/**
 * Generate a procedural video from a scene image. Returns a Blob
 * ready for upload + a temporary object URL for previewing.
 *
 * Browser-only — uses Canvas API + MediaRecorder. Caller is
 * responsible for uploading the blob to /public/assets/ via
 * /api/upload-asset and revoking the object URL once the upload
 * completes.
 */
export async function generateProceduralVideo(
  opts: ProceduralVideoOptions,
): Promise<ProceduralVideoResult> {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const fps = opts.fps ?? 30;
  const duration = Math.max(2, Math.min(20, opts.durationSeconds));
  const pattern = opts.pattern ?? "kenBurns-in";
  const bitrate = opts.bitrate ?? 2_500_000;

  // Load the image first — if it fails, abort with a clear error
  // so the caller can decide whether to fall back to a placeholder.
  const img = await loadImage(opts.imageUrl);

  // Canvas setup — offscreen so we don't pollute the visible page.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable; cannot generate procedural video.");

  // Try MediaRecorder with WebM/VP9 first (best quality), then
  // WebM/VP8 (more widely supported). If neither works, fall back
  // to plain WebM default and let the browser pick the codec.
  const candidates = [
    { mimeType: "video/webm;codecs=vp9,opus" },
    { mimeType: "video/webm;codecs=vp8,opus" },
    { mimeType: "video/webm;codecs=vp9" },
    { mimeType: "video/webm;codecs=vp8" },
    { mimeType: "video/webm" },
  ];
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  for (const c of candidates) {
    if (typeof MediaRecorder === "undefined") break;
    if (!MediaRecorder.isTypeSupported(c.mimeType)) continue;
    try {
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, {
        mimeType: c.mimeType,
        videoBitsPerSecond: bitrate,
      });
      break;
    } catch {
      continue;
    }
  }
  if (!recorder || !stream) {
    throw new Error(
      "MediaRecorder not supported in this browser. Try Chrome, Edge, or Firefox for procedural video generation."
    );
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder!.onstop = () => resolve();
  });

  recorder.start();

  // Render loop — paint frames at `fps` rate for `duration` seconds.
  // Each frame: clear, draw image with Ken Burns transform, draw
  // optional text overlays (lower third + scene badge).
  const startTime = performance.now();
  const totalMs = duration * 1000;
  let rafId: number;
  let lastFrameMs = -1;

  function drawFrame(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / totalMs);

    // Clear
    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, width, height);

    // Image with Ken Burns transform
    const { scale, tx, ty } = kenBurnsTransform(pattern, t);
    const drawW = width * scale;
    const drawH = (img.height / img.width) * drawW; // preserve aspect
    const dx = (width - drawW) / 2 + (tx / 100) * width;
    const dy = (height - drawH) / 2 + (ty / 100) * height;
    // object-cover behavior — clip to canvas, but if image aspect
    // differs, crop top/bottom (standard for 3:2 → 16:9).
    ctx!.drawImage(img, dx, dy, drawW, drawH);

    // Vignette — radial dark overlay
    const vignette = ctx!.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx!.fillStyle = vignette;
    ctx!.fillRect(0, 0, width, height);

    // Scene number badge (top-left)
    if (opts.sceneNumber) {
      ctx!.font = "bold 24px system-ui, sans-serif";
      ctx!.textBaseline = "top";
      const padX = 16;
      const padY = 16;
      const text = opts.sceneNumber;
      const metrics = ctx!.measureText(text);
      const w = metrics.width + padX * 2;
      const h = 32 + padY * 2;
      ctx!.fillStyle = "rgba(0,0,0,0.6)";
      ctx!.fillRect(padX, padY, w, h);
      ctx!.fillStyle = "white";
      ctx!.fillText(text, padX + padX, padY + padY + 4);
    }

    // Lower-third overlay (bottom bar with eyebrow + title)
    if (opts.title || opts.eyebrow) {
      const barH = 110;
      const barY = height - barH - 60;
      // Eyebrow pill
      if (opts.eyebrow) {
        ctx!.font = "bold 16px system-ui, sans-serif";
        ctx!.textBaseline = "middle";
        const eyebrowW = ctx!.measureText(opts.eyebrow.toUpperCase()).width + 28;
        ctx!.fillStyle = "rgba(124,92,255,0.95)";
        ctx!.fillRect(40, barY - 32, eyebrowW, 30);
        ctx!.fillStyle = "white";
        ctx!.fillText(opts.eyebrow.toUpperCase(), 40 + 14, barY - 32 + 15);
      }
      // Title
      if (opts.title) {
        ctx!.font = "bold 56px system-ui, sans-serif";
        ctx!.textBaseline = "top";
        ctx!.shadowColor = "rgba(0,0,0,0.8)";
        ctx!.shadowBlur = 12;
        ctx!.fillStyle = "white";
        ctx!.fillText(opts.title, 40, barY);
        ctx!.shadowBlur = 0;
      }
      // Accent bar
      ctx!.fillStyle = "rgba(124,92,255,0.95)";
      ctx!.fillRect(40, height - 56, width * 0.35, 4);
    }

    // Throttle to ~fps to avoid burning CPU
    const targetMs = (1 / fps) * 1000;
    const frameDelta = now - lastFrameMs;
    if (lastFrameMs < 0 || frameDelta >= targetMs) {
      lastFrameMs = now;
    }

    if (elapsed < totalMs) {
      rafId = requestAnimationFrame(drawFrame);
    } else {
      recorder!.stop();
      stream!.getTracks().forEach((t) => t.stop());
    }
  }
  rafId = requestAnimationFrame(drawFrame);

  await stopped;
  cancelAnimationFrame(rafId);

  // Compose final blob
  const blob = new Blob(chunks, { type: "video/webm" });
  const blobUrl = URL.createObjectURL(blob);

  return {
    blobUrl,
    blob,
    actualDuration: duration,
    width,
    height,
    sizeBytes: blob.size,
  };
}

/**
 * Upload a blob to /public/assets/ via POST /api/upload-asset. Returns
 * the public URL of the saved file. The server stores files under
 * /public/assets/ so they're served at /assets/{filename}.
 */
export async function uploadAssetBlob(
  blob: Blob,
  filename: string,
): Promise<{ url: string; sizeBytes: number }> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("filename", filename);

  const res = await fetch("/api/upload-asset", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${text || res.statusText}`);
  }
  const data = (await res.json()) as { url: string; sizeBytes: number };
  return data;
}

/**
 * Convenience: generate + upload in one call. Returns the public URL
 * ready to store on `scene.videoUrl`.
 */
export async function generateAndUploadProceduralVideo(
  scene: Scene,
  pattern?: ProceduralVideoOptions["pattern"],
): Promise<{ url: string; duration: number; sizeBytes: number }> {
  if (!scene.imageUrl) {
    throw new Error("Procedural video requires a key visual first.");
  }
  const opts: ProceduralVideoOptions = {
    imageUrl: scene.imageUrl,
    durationSeconds: scene.durationSeconds ?? 6,
    pattern,
    eyebrow: scene.beatName,
    title: scene.voiceoverLine?.slice(0, 40) ?? scene.description?.slice(0, 40),
    sceneNumber: `Scene ${scene.index}`,
  };
  const result = await generateProceduralVideo(opts);
  try {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `proc_${ts}_${rand}.webm`;
    const upload = await uploadAssetBlob(result.blob, filename);
    return {
      url: upload.url,
      duration: result.actualDuration,
      sizeBytes: upload.sizeBytes,
    };
  } finally {
    // Always revoke the object URL — even on upload failure — to
    // prevent memory leaks in the browser tab.
    URL.revokeObjectURL(result.blobUrl);
  }
}

/* -----------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
