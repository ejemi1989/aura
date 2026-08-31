// Demo-mode asset generation.
//
// When no provider key is set, the /api/generate/* routes fall back to
// these so the studio remains fully visible: real PNGs for images (not
// 1×1 transparents), a real short mp4 for video (color bars + tone), a
// real sine-wave WAV for TTS. The user can see every panel populated
// even with zero API keys.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

const exec = promisify(execFile);

/* ---------------------------------------------------------------------- */
/*  Image demo                                                             */
/* ---------------------------------------------------------------------- */

/**
 * Renders a deterministic but visually distinct placeholder for a given
 * prompt as a real 1792×1024 PNG — generated entirely in Node with zero
 * external binaries (no rsvg-convert, no ImageMagick). We write the PNG
 * container and scanlines by hand and compress IDAT with node:zlib, so it
 * works identically on any machine the app runs on.
 *
 * The design is a vertical dual-hue gradient with a soft "glow" accent and
 * a title card region, color derived from a stable hash of the prompt so
 * different briefs render visually distinct storyboard frames.
 */
export async function renderDemoImage(prompt: string, id: string): Promise<string> {
  const dir = join(process.cwd(), "public", "assets");
  await mkdir(dir, { recursive: true });
  const filename = `${id}.png`;
  const outPath = join(dir, filename);

  const hash = createHash("sha256").update(prompt).digest();
  const hue = hash[0];
  const hue2 = (hash[1] + 60) % 360;
  const accentHue = (hash[2] + 180) % 360;
  const title = prompt.length > 60 ? prompt.slice(0, 57) + "…" : prompt;

  const W = 1792;
  const H = 1024;

  // Precompute the two gradient stops as RGB.
  const top = hslToRgb(hue, 0.7, 0.35);
  const bottom = hslToRgb(hue2, 0.7, 0.18);
  const accent = hslToRgb(accentHue, 0.75, 0.55);
  // Lighten the accent for the glow (blend toward white).
  const glow = blend(accent, [255, 255, 255], 0.35);

  // Fill the pixel buffer top-to-bottom. Each row has a leading 0 filter
  // byte (PNG filter type 0 = None) so decompression is trivial.
  const buf = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const rowBase = blend(top, bottom, t);
    buf[p++] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      // Radial-ish glow from the upper-left third.
      const dx = (x / W - 0.3) * 2;
      const dy = (y / H - 0.3) * 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      const glowAmt = Math.max(0, 1 - d) ** 2 * 0.55;
      let rgb = blend(rowBase, glow, glowAmt);
      // Title bar: a translucent dark band near the bottom for the text.
      if (y > H - 200) rgb = blend(rgb, [0, 0, 0], 0.25);
      buf[p++] = rgb[0];
      buf[p++] = rgb[1];
      buf[p++] = rgb[2];
    }
  }

  const png = encodePng(W, H, buf);
  await writeFile(outPath, png);
  return `/assets/${filename}`;
}

/* ------------------------- pure-Node PNG encoder ----------------------- */

function blend(a: number[], b: number[], t: number): number[] {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function hslToRgb(h: number, s: number, l: number): number[] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Builds a valid PNG (RGBA color type 6 not used — RGB type 2) from raw RGB rows. */
function encodePng(width: number, height: number, rawRgbWithFilters: Buffer): Buffer {
  const crcTable = makeCrcTable();
  const chunks: Buffer[] = [];

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(chunk("IHDR", ihdr, crcTable));

  // IDAT (deflate the filtered scanlines)
  const idat = deflateSync(rawRgbWithFilters, { level: 6 });
  chunks.push(chunk("IDAT", idat, crcTable));

  // IEND
  chunks.push(chunk("IEND", Buffer.alloc(0), crcTable));

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ...chunks]);
}

function chunk(type: string, data: Buffer, crcTable: Int32Array): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeBuf, data, crcTable) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeCrcTable(): Int32Array {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(type: Buffer, data: Buffer, table: Int32Array): number {
  let c = 0xffffffff;
  for (const b of Buffer.concat([type, data])) {
    c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}

/* ---------------------------------------------------------------------- */
/*  TTS demo                                                               */
/* ---------------------------------------------------------------------- */

/**
 * Generates a short sine-wave WAV (440Hz tone, 0.8s, 22.05 kHz mono)
 * using only Node — no external binary needed. The result is small
 * (~36 KB) and plays in any browser, so the <audio> element in the
 * workspace shows real duration, the waveform component renders real
 * bars, and the timeline view shows the right length.
 */
export async function renderDemoTone(id: string, voiceTone: string = "warm", textHint: string = ""): Promise<{ url: string; durationMs: number }> {
  const dir = join(process.cwd(), "public", "assets");
  await mkdir(dir, { recursive: true });
  const filename = `${id}.wav`;
  const outPath = join(dir, filename);

  // Pick a base frequency per voice tone so the demo audio is
  // perceptually distinct between voice moods.
  const baseFreq: Record<string, number> = {
    warm: 392,        // G4
    energetic: 523,   // C5
    authoritative: 311, // Eb4
    calm: 261,        // C4
    playful: 659,     // E5
  };
  const toneBase = baseFreq[voiceTone] ?? 440;

  // Modulate frequency by a hash of the scene's text so each scene's
  // demo narration sounds distinct (different pitch + a per-scene
  // melody) instead of all scenes sharing one tone. The variation is
  // intentionally narrow (within one octave of the tone base) so the
  // narration still sounds coherent within a single voice mood.
  const hash = textHint
    ? createHash("sha256").update(textHint).digest()
    : Buffer.from([0, 0, 0, 0]);
  const semitoneOffset = (hash[0] % 11) - 5; // -5..+5 semitones
  const sceneFreq = toneBase * Math.pow(2, semitoneOffset / 12);

  // Pick a melody shape from the hash so each scene plays a slightly
  // different sequence of notes — distinct enough that you can hear the
  // difference between scenes at a glance.
  const melodyStep = (hash[1] % 5) + 3; // 3..7 notes
  const noteDurMs = 220; // ~220ms per note, so total length scales with melodyStep
  const durationSec = (melodyStep * noteDurMs) / 1000;
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);

  const dataSize = numSamples * 2; // 16-bit mono
  const fileSize = 36 + dataSize;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  const noteSamples = Math.floor((noteDurMs / 1000) * sampleRate);
  const attack = Math.floor(sampleRate * 0.02);
  const release = Math.floor(sampleRate * 0.05);
  for (let i = 0; i < numSamples; i++) {
    const noteIdx = Math.floor(i / noteSamples);
    const localI = i - noteIdx * noteSamples;
    // Each subsequent note steps up or down by a small interval based
    // on the hash so the melody is unique per scene.
    const dir = (hash[2 + noteIdx] ?? 0) & 1 ? 1 : -1;
    const step = 1 + ((hash[2 + noteIdx] ?? 0) >> 1) % 3; // 1..3 semitones
    const noteFreq = sceneFreq * Math.pow(2, (dir * step * (noteIdx + 1)) / 12);

    let envelope = 1;
    if (localI < attack) envelope = localI / attack;
    else if (localI > noteSamples - release) envelope = (noteSamples - localI) / release;

    const sample = Math.sin((2 * Math.PI * noteFreq * i) / sampleRate) * envelope * 0.4;
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  await writeFile(outPath, buf);
  return { url: `/assets/${filename}`, durationMs: durationSec * 1000 };
}

/* ---------------------------------------------------------------------- */
/*  Video demo                                                             */
/* ---------------------------------------------------------------------- */

/**
 * Generates a short mp4 with ffmpeg showing the scene's description over
 * a colored background — a real, playable video that previews correctly
 * in the <video> element. Falls back to a stub file if ffmpeg is missing
 * (the UI will detect this and switch to the slideshow path).
 */
export async function renderDemoVideo(
  id: string,
  prompt: string,
  durationSeconds: number
): Promise<{ url: string }> {
  const dir = join(process.cwd(), "public", "assets");
  await mkdir(dir, { recursive: true });
  const filename = `${id}.mp4`;
  const outPath = join(dir, filename);

  // Pick a stable color per scene so the demo video matches the demo
  // image's color family.
  const hash = createHash("sha256").update(prompt).digest();
  const r = hash[0];
  const g = hash[1];
  const b = hash[2];
  const color = `0x${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

  try {
    // 30fps, h264, AAC audio (silent), 1280x720, with a color background
    // and a drawtext overlay showing the first 60 chars of the prompt.
    const safeText = prompt.replace(/[\\':%]/g, "").slice(0, 60);
    const args = [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=${color}:s=1280x720:d=${durationSeconds}:r=24`,
      "-f", "lavfi",
      "-i", `anullsrc=channel_layout=stereo:sample_rate=44100`,
      "-t", String(durationSeconds),
      "-vf", `drawtext=fontcolor=white:fontsize=42:x=80:y=(h-text_h)/2:text='${safeText}':box=1:boxcolor=black@0.45:boxborderw=24,drawtext=fontcolor=white@0.6:fontsize=22:x=80:y=h-80:text='DEMO \\: no video provider key'`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "96k",
      "-shortest",
      "-movflags", "+faststart",
      outPath,
    ];
    await exec("ffmpeg", args, { timeout: 60_000 });
    return { url: `/assets/${filename}` };
  } catch {
    // No ffmpeg — we can't produce a real mp4. The VideoPreview will
    // detect playback failure and fall back to the slideshow path, so
    // it's safe to return a sentinel. We use a "no video" marker that
    // the in-app tool can recognize and substitute with the scene's
    // still image instead.
    const buf = Buffer.from("NO_VIDEO", "utf-8");
    await writeFile(outPath, buf);
    return { url: "__no_video__" };
  }
}

/* ---------------------------------------------------------------------- */
/*  Asset ID generator                                                     */
/* ---------------------------------------------------------------------- */

export function newAssetId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(3).toString("hex")}`;
}
