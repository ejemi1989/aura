// Supabase + R2 artifact write-through for the studio's WebMCP tools.
//
// The HTTP routes under src/app/api/generate/* persist the binary to
// R2 (or local-disk fallback) and return the public URL. They don't
// know about Supabase. This helper closes the loop: given the URL, the
// project + scene context, and the artifact type, it extracts the R2
// storage key from the URL, computes the deterministic cache key, and
// writes an `artifacts` row in Supabase (best-effort, never throws).
//
// Failure here is non-fatal — the asset is still rendered for the user;
// the durable database record just doesn't land. A console.warn makes
// it visible to operators without crashing the demo.

import {
  persistArtifactWithMetadata,
  recordGenerationJob,
  recordHumanDecision,
  recordToolRun,
  type ArtifactRow,
} from "@/lib/supabase/writers";
// NOTE: We deliberately do NOT import from @/lib/providers/assetStore here.
// That module pulls in `node:fs/promises` for the local-disk fallback, which
// webpack refuses to bundle for the browser. This module is imported by both
// the browser (via WebMCP tool wrappers in src/lib/webmcp/tools/) and the
// server (via API routes). Keeping it server-only-safe is the whole point.

const PROJECT_PREFIX_RE = /^projects\//;

function extractStorageKey(url: string): string {
  if (!url) return "";
  // Inline demo placeholders (data: URLs) have no durable storage key —
  // returning "" makes threadArtifactToSupabase a no-op for them so we
  // never persist a base64 blob as if it were a bucket object key.
  if (url.startsWith("data:")) return "";
  // Local-disk fallback: /assets/<key>
  if (url.startsWith("/assets/")) return url.slice("/assets/".length);
  // R2: any absolute URL, return the path (drops query string from presigned URLs).
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return url;
  }
}

interface CacheKeyInput {
  tool: "image" | "tts" | "video";
  prompt?: string;
  model?: string;
  duration?: number;
  voice?: string;
  // Inputs that affect generation but aren't in the prompt directly.
  size?: string;
  motionNotes?: string;
  aspectRatio?: string;
  inputArtifact?: string; // R2 key of the input image for i2v
}

/**
 * Stable hash of the generation signature. Same generation inputs ⇒ same key.
 *
 * Deliberately CONTENT-ONLY (no projectName / sceneNumber): a given prompt +
 * size + model + voice produces the same visual/audio wherever it's asked
 * for, so identical assets are reused across campaigns, scenes, and users.
 * This is what lets the cache skip a paid API call on a repeat request.
 */
function cacheKey(input: CacheKeyInput): string {
  const parts: Record<string, unknown> = {
    tool: input.tool,
    prompt: input.prompt ?? "",
    model: input.model ?? "",
    duration: input.duration ?? "",
    voice: input.voice ?? "",
    size: input.size ?? "",
    motionNotes: input.motionNotes ?? "",
    aspectRatio: input.aspectRatio ?? "",
    inputArtifact: input.inputArtifact ?? "",
  };
  // Sorted JSON → stable string → cheap FNV-1a-ish hash → base36.
  const json = JSON.stringify(parts, Object.keys(parts).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface ThreadArtifactArgs {
  url: string;
  projectSupabaseId?: number;
  sceneSupabaseId?: number | null;
  type: ArtifactRow["type"];
  mimeType: string;
  provider?: string;
  cacheInput?: CacheKeyInput;
  /** Extra metadata persisted alongside the artifact row. */
  metadata?: Record<string, unknown>;
}

/**
 * One-shot helper. Persists the artifact metadata to Supabase if
 * configured. Never throws.
 */
export async function threadArtifactToSupabase(args: ThreadArtifactArgs) {
  if (args.projectSupabaseId == null) return;
  const storageKey = extractStorageKey(args.url);
  if (!storageKey) return;
  const finalMetadata: Record<string, unknown> = {
    ...(args.metadata ?? {}),
  };
  const result = await persistArtifactWithMetadata({
    projectId: args.projectSupabaseId,
    sceneId: args.sceneSupabaseId ?? null,
    type: args.type,
    storageKey,
    mimeType: args.mimeType,
    provider: args.provider ?? "openai",
    status: "available",
    metadata: finalMetadata,
    cacheKey: args.cacheInput ? cacheKey(args.cacheInput) : `adhoc:${Date.now()}`,
  });
  // Result is best-effort: if it lands, great; if not, the warn inside
  // persistArtifactWithMetadata already surfaced the cause.
  return result;
}

export async function threadGenerationJob(args: {
  projectSupabaseId?: number;
  sceneSupabaseId?: number | null;
  toolName: string;
  provider: string;
  externalJobId?: string | null;
  status: Parameters<typeof recordGenerationJob>[0]["status"];
  error?: string | null;
}) {
  if (args.projectSupabaseId == null) return;
  return recordGenerationJob({
    projectId: args.projectSupabaseId,
    sceneId: args.sceneSupabaseId ?? null,
    toolName: args.toolName,
    provider: args.provider,
    externalJobId: args.externalJobId ?? null,
    status: args.status,
    error: args.error ?? null,
  });
}

export async function threadHumanDecision(args: {
  projectSupabaseId?: number;
  sceneSupabaseId?: number | null;
  decision: Parameters<typeof recordHumanDecision>[0]["decision"];
  instruction?: string | null;
}) {
  if (args.projectSupabaseId == null) return;
  return recordHumanDecision({
    projectId: args.projectSupabaseId,
    sceneId: args.sceneSupabaseId ?? null,
    decision: args.decision,
    instruction: args.instruction ?? null,
  });
}

export async function threadToolRun(args: {
  projectSupabaseId?: number;
  sceneSupabaseId?: number | null;
  toolName: string;
  agent: string;
  status?: "running" | "success" | "error" | "rejected" | "timeout";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
}) {
  if (args.projectSupabaseId == null) return;
  return recordToolRun({
    projectId: args.projectSupabaseId,
    sceneId: args.sceneSupabaseId ?? null,
    toolName: args.toolName,
    agent: args.agent,
    status: args.status ?? "success",
    input: args.input ?? {},
    output: args.output ?? {},
    error: args.error ?? null,
  });
}

export { extractStorageKey, cacheKey, PROJECT_PREFIX_RE };
export type { CacheKeyInput };
