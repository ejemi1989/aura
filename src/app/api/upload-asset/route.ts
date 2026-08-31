// POST /api/upload-asset
//
// Receives a Blob (FormData field "file"), validates filename, and
// persists to /public/assets/ so it's served at /assets/{filename}.
//
// Used by the procedural video fallback (src/lib/proceduralVideo.ts)
// to ship real video files when no external video provider is reachable.
// Also used by any future client-side generator (e.g. browser-rendered
// WebM animations).

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 120;

const PUBLIC_ASSETS_DIR = join(process.cwd(), "public", "assets");
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB cap per upload

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "multipart_parse_failed", message: "Request body must be multipart/form-data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: "missing_file", message: "FormData must include a 'file' Blob field." },
      { status: 400 },
    );
  }
  const filenameRaw = (form.get("filename") as string) || file.name || "upload.bin";
  const filename = sanitizeFilename(filenameRaw);
  if (!filename) {
    return NextResponse.json(
      { ok: false, error: "invalid_filename", message: "Filename must contain at least one alphanumeric character." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", message: `File exceeds ${MAX_BYTES / 1024 / 1024} MB cap.` },
      { status: 413 },
    );
  }

  await fs.mkdir(PUBLIC_ASSETS_DIR, { recursive: true });
  const target = join(PUBLIC_ASSETS_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(target, buf);

  return NextResponse.json({
    ok: true,
    url: `/assets/${filename}`,
    filename,
    sizeBytes: buf.length,
    contentType: file.type || "application/octet-stream",
  });
}

/** Sanitize filename — keep alphanumerics, dashes, dots, underscores.
 *  Reject path traversal (..\\, ../, /, \\). Cap length at 80. */
function sanitizeFilename(input: string): string {
  let s = String(input || "").trim();
  s = s.replace(/^[\\/]+/, "").replace(/[\\/]+/g, "_");
  s = s.replace(/[^A-Za-z0-9._-]/g, "_");
  s = s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (s.length > 80) s = s.slice(0, 80);
  if (!s || !/[A-Za-z0-9]/.test(s)) return "";
  // Block reserved Windows names
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(s)) return "";
  return s;
}
