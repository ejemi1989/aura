// Next.js middleware. Refreshes the Supabase auth session on every request
// so Server Components downstream see a valid auth.uid() on first read.
//
// The matcher excludes static assets, the favicon, local /assets/ uploads
// (from the local-disk fallback), and the health endpoint — none of those
// need Supabase session handling.

import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - assets/* (local-disk fallback public assets)
     * - api/health (cheap health probe, no auth needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|assets/|api/health).*)",
  ],
};
