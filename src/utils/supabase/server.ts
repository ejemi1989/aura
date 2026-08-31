// Server-side Supabase client (per-request, with cookies).
//
// Used by Server Components, Route Handlers, and Server Actions. The
// cookies store carries the user's session; the publishable key
// identifies the request to RLS. Server-side privileged operations
// (creating projects, inserting artifacts) use src/lib/supabase/server.ts
// instead — that client carries the service-role key and bypasses RLS.
//
// Pattern adapted from the official @supabase/ssr Next.js guide.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

export async function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Setting cookies from a Server Component is a no-op in Next.js 14;
          // middleware is responsible for refreshing the session.
        }
      },
    },
  });
}
