// Browser-side Supabase client (the publishable key only).
//
// Used by any client component that needs to talk to Supabase — for
// example, Realtime subscriptions on the control room. Server-side
// operations use src/utils/supabase/server.ts instead, which carries the
// service-role key for privileged writes.
//
// The publishable key is safe to ship to the browser; RLS policies are the
// security boundary for what an authenticated user can read/write. See
// supabase/migrations/20260830_aura_init.sql for the current policies.

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseKey);
}
