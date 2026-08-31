// Best-effort global content cache for generated assets.
//
// The cache key is a content-only hash of the generation inputs (tool +
// prompt + size + model + voice + source artifact) — computed by the same
// `cacheKey` used at write time in threading.ts, so a lookup here always
// matches the key that was persisted with the asset.
//
// All functions are best-effort: any failure returns null and the caller
// falls through to a normal generation instead of breaking the pipeline.

import { findCachedArtifactByKey, r2PublicUrlFor } from "@/lib/supabase/writers";
import { cacheKey } from "@/lib/supabase/threading";
import type { CacheKeyInput } from "@/lib/supabase/threading";

/**
 * Look up a cached generation by its content signature. On a hit returns the
 * already-uploaded public URL (free — no paid API call); on a miss or any
 * error returns null so the caller proceeds with a normal generation.
 */
export async function lookupCachedArtifact(
  input: CacheKeyInput
): Promise<{ url: string; storageKey: string; metadata: Record<string, unknown> } | null> {
  const rec = await findCachedArtifactByKey(cacheKey(input));
  if (!rec) return null;
  return {
    url: r2PublicUrlFor(rec.storage_key),
    storageKey: rec.storage_key,
    metadata: (rec.metadata ?? {}) as Record<string, unknown>,
  };
}

/**
 * Compute the content cache key for a set of generation inputs. Thin wrapper
 * around threading.ts's `cacheKey` so call sites read clearly.
 */
export function contentCacheKey(input: CacheKeyInput): string {
  return cacheKey(input);
}
