// Middleware Supabase helper.
//
// Corrected shape of the original template: the user's pasted version
// returned `supabaseResponse` from a local `supabase` variable that wasn't
// constructed. The real @supabase/ssr pattern is:
//
//   1. Build a pass-through response.
//   2. Build a server client wired to the request cookies.
//   3. Force a session refresh via `await supabase.auth.getUser()`.
//   4. Return the response (with refreshed cookies attached).
//
// `refreshSession` writes the refreshed cookies onto both the request
// (so downstream route handlers see the new state) and the response (so
// the browser receives it).

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request: NextRequest) {
  // When env vars aren't set (e.g., during build), just pass through.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror onto both the request (for downstream handlers) and the
        // response (so the browser receives the refresh).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Force-refresh the session if it's about to expire. Server Components
  // depend on this so they see a valid auth.uid() on first read.
  await supabase.auth.getUser();

  return response;
}
