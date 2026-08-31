// Asset storage abstraction.
//
// Generated assets (images, audio, video) need a stable public URL the
// browser can render. The default implementation writes to the local
// filesystem under /public/assets — perfect for local dev. Production
// deployments activate the R2-backed implementation automatically when
// the R2_* env vars are present.
//
// Storage layout (per .context/system.md §21):
//
//   {pathPrefix}/{prefix}_{timestamp}_{rand}.{ext}
//
// where `pathPrefix` is one of:
//   projects/{projectId}/scenes/{sceneId}/image
//   projects/{projectId}/scenes/{sceneId}/video
//   projects/{projectId}/scenes/{sceneId}/audio
//   projects/{projectId}/scenes/{sceneId}/captions
//   projects/{projectId}/final
//
// When `pathPrefix` is omitted, the legacy flat layout is used
// (`{prefix}_{ts}_{rand}.{ext}`), so callers that don't know their
// projectId/sceneId — e.g. a future utility tool — keep working.
//
// URL delivery:
//   - If R2_PUBLIC_URL is set, the response URL is `${R2_PUBLIC_URL}/${key}`.
//   - Otherwise, R2 returns a presigned GET URL (default 1h expiry).

import { getR2Client, isR2Configured } from "./r2AssetStore";

export interface StoredAssetOptions {
  ext: string;
  prefix: string;
  contentType: string;
  /**
   * Hierarchical path within the bucket, e.g.
   * `projects/p_123/scenes/s_456/image`. The final storage key is
   * `${pathPrefix}/${prefix}_${ts}_${rand}.${ext}`.
   *
   * Omit for the legacy flat layout (used by callers that don't have
   * a projectId/sceneId).
   */
  pathPrefix?: string;
}

export interface AssetStore {
  put(data: Buffer | Uint8Array, options: StoredAssetOptions): Promise<string>;
  mirror(
    url: string,
    options: { ext: string; prefix: string; pathPrefix?: string },
  ): Promise<string>;
}

/** Build a content-type guess from extension when caller doesn't supply one. */
function guessContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "json":
      return "application/json";
    case "srt":
      return "application/x-subrip";
    default:
      return "application/octet-stream";
  }
}

function buildKey(prefix: string, ext: string, pathPrefix?: string): string {
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.${ext}`;
  return pathPrefix ? `${pathPrefix.replace(/\/+$/, "")}/${filename}` : filename;
}

/** Writes bytes to /public/assets and serves them from the same origin. */
const localDiskStore: AssetStore = {
  async put(data, options) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const key = buildKey(options.prefix, options.ext, options.pathPrefix);
    const fullPath = path.join(process.cwd(), "public", "assets", key);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, data);
    return `/assets/${key}`;
  },
  async mirror(url, options) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch upstream asset (${res.status}): ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") ?? guessContentType(options.ext);
    return this.put(buf, { ext: options.ext, prefix: options.prefix, contentType, pathPrefix: options.pathPrefix });
  },
};

/**
 * R2-backed implementation. Activates when R2_BUCKET + R2_ACCESS_KEY_ID +
 * R2_SECRET_ACCESS_KEY are all set. Throws on upload failure rather than
 * silently falling back to local-disk — providers can catch and decide.
 */
const r2Store: AssetStore = {
  async put(data, options) {
    const client = await getR2Client();
    const key = buildKey(options.prefix, options.ext, options.pathPrefix);
    await client.putObject({
      Bucket: client.bucket,
      Key: key,
      Body: data,
      ContentType: options.contentType || guessContentType(options.ext),
    });
    return client.urlFor(key);
  },
  async mirror(url, options) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch upstream asset (${res.status}): ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") ?? guessContentType(options.ext);
    return this.put(buf, {
      ext: options.ext,
      prefix: options.prefix,
      contentType,
      pathPrefix: options.pathPrefix,
    });
  },
};

/** The active asset store. R2 wins when configured. */
let activeStore: AssetStore = isR2Configured() ? r2Store : localDiskStore;

/** Point the store elsewhere (used by tests or future bootstrap wiring). */
export function setAssetStore(store: AssetStore): void {
  activeStore = store;
}

/** Which backend is currently active, for diagnostics. */
export function activeAssetStoreName(): "r2" | "local-disk" {
  return activeStore === r2Store ? "r2" : "local-disk";
}

/** Persist raw bytes and return a stable public URL. */
export async function persistAsset(
  data: Buffer | Uint8Array,
  options: StoredAssetOptions
): Promise<string> {
  return activeStore.put(data, options);
}

/** Fetch a remote URL, persist the bytes, and return a stable public URL. */
export async function mirrorRemoteAsset(
  url: string,
  options: { ext: string; prefix: string; pathPrefix?: string }
): Promise<string> {
  return activeStore.mirror(url, options);
}
