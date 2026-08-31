// Service-role Supabase client for server-side privileged operations.
//
// Used by the providers (create_project, generate_image, text_to_speech,
// image_to_video, request_human_approval) to write structured production
// state. Bypasses RLS by design — these are server-initiated writes on
// behalf of an authenticated user whose session is held by the cookie-
// bound client in src/utils/supabase/server.ts.
//
// Lazy-constructed so a missing SUPABASE_SECRET_KEY at boot doesn't crash
// the entire app: every call goes through `getSupabaseServiceClient()`,
// which throws a clear error the first time it's invoked without a key set.
// This keeps the studio runnable in pure demo mode without Supabase.
//
// Typed as `SupabaseClient<any, "public", any>` so table queries don't
// collapse to `never` in the absence of a generated Database type. Once
// the schema stabilizes we can swap in a typed `Database` interface.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, "public", any>;
let cached: AnyClient | null = null;

export function getSupabaseServiceClient(): AnyClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SERVICE_ROLE;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service-role env vars missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to enable production-state writes.",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

/**
 * Best-effort helper for callers that should not crash the studio if
 * Supabase isn't configured. Returns null instead of throwing. Logs a
 * one-line warning the first time per process to make the missing
 * configuration visible without spamming logs.
 */
let warnedMissing = false;
export function trySupabaseServiceClient(): AnyClient | null {
  try {
    return getSupabaseServiceClient();
  } catch (err) {
    if (!warnedMissing) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[supabase] disabled: ${msg}. Set SUPABASE_SECRET_KEY to enable durable production-state writes; the studio still works in local-only mode.`,
      );
      warnedMissing = true;
    }
    return null;
  }
}

/**
 * Test helper. Allows tests and rebuilds to clear the cached service-role
 * client after rotating env vars.
 */
export function _resetSupabaseServiceClientForTests() {
  cached = null;
  warnedMissing = false;
}
