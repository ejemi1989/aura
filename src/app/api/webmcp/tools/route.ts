import { NextRequest, NextResponse } from "next/server";
import { WEB_MCP_HTTP_TOOLS } from "@/lib/webmcp/catalog";

export const runtime = "nodejs";

/**
 * GET /api/webmcp/tools
 *
 * Public catalog of the studio's WebMCP tools, in the spec's
 * MCP-flavored shape. External agents that don't have a browser
 * context (server-side orchestrators, partner backends, CI
 * integrations) can use this endpoint to discover what the studio can do.
 *
 * Browser agents should still use `document.modelContext.getTools()` (or
 * `navigator.modelContext.getTools()` on Chrome 149 origin-trial builds)
 * so they get live tool results with proper user interaction handling —
 * this HTTP catalog is a fallback, not a replacement.
 *
 * **Security:** The WebMCP spec requires that WebMCP only works in
 * SecureContext (HTTPS or localhost). Reaching this endpoint over an
 * insecure transport should be refused; we enforce that here as well.
 * Browsers also gate `document.modelContext` behind the "tools"
 * permission policy and origin-keyed agent clusters — both of which
 * the browser handles automatically when the in-app `registerTool()`
 * path runs.
 */
export async function GET(req: NextRequest) {
  if (!isSecureRequest(req)) {
    return NextResponse.json(
      {
        error: "insecure_transport",
        message:
          "WebMCP tools may only be served over a SecureContext (HTTPS or localhost).",
      },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      schemaVersion: "1.0",
      studio: "creative-studio",
      capability: "webmcp-bridge",
      toolCount: WEB_MCP_HTTP_TOOLS.length,
      tools: WEB_MCP_HTTP_TOOLS,
    },
    {
      headers: {
        // Spec compliance: cache briefly so an agent polling getTools()
        // doesn't hammer the server, but stay short enough that newly
        // registered tools become visible quickly.
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}

/**
 * The WebMCP spec defines WebMCP as a `[SecureContext]` feature. Mirror
 * that here for the HTTP catalog: only allow requests from HTTPS hosts
 * (or localhost) on the appropriate ports.
 */
function isSecureRequest(req: NextRequest): boolean {
  const url = req.nextUrl;
  // localhost on http is treated as secure by browsers (see the
  // "potentially trustworthy" definition in the Secure Contexts spec).
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return true;
  }
  if (url.protocol === "https:") return true;
  // Reverse proxies often set x-forwarded-proto.
  const fwd = req.headers.get("x-forwarded-proto");
  if (fwd === "https") return true;
  return false;
}
