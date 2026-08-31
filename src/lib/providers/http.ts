// Shared HTTP utilities for provider calls. Kept tiny and dependency-free —
// the rest of the app already pulls in `openai` and `next`, and we don't
// need an SDK for the third-party providers (fal, runway, etc. all have
// straightforward REST surfaces).

import { NextResponse } from "next/server";

export interface UpstreamError {
  provider: string;
  status: number;
  message: string;
}

export function upstreamErrorResponse(err: UpstreamError) {
  return NextResponse.json(
    {
      error: "upstream_error",
      provider: err.provider,
      status: err.status,
      message: err.message,
    },
    { status: 502 }
  );
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return NextResponse.json(
    { error: "bad_request", message, fields: fields ?? {} },
    { status: 400 }
  );
}

export function notConfigured(provider: string, capability: string) {
  return NextResponse.json(
    {
      error: "not_configured",
      provider,
      capability,
      message: `${capability} requires ${provider} credentials. Set ${provider.toUpperCase()}_KEY in the environment, or enable DEMO_MODE to use placeholders.`,
    },
    { status: 503 }
  );
}

// Asset persistence is routed through the swappable store in assetStore.ts
// (local disk by default; S3/R2 on serverless). These re-exports keep the
// rest of the provider code importing from ./http unchanged.

/**
 * Persist a generated asset (image or audio bytes) to a stable URL the
 * browser can use. This sidesteps CORS, lets the <video>/<audio>/<img>
 * elements work without cross-origin auth, and gives the studio something
 * to render in any environment.
 */
export async function persistAsset(
  data: Buffer | Uint8Array,
  options: { ext: string; prefix: string; contentType: string }
): Promise<string> {
  const { persistAsset: storeAsset } = await import("./assetStore");
  return storeAsset(data, options);
}

/** Same as persistAsset but accepts a remote URL to mirror down. */
export async function mirrorRemoteAsset(
  url: string,
  options: { ext: string; prefix: string }
): Promise<string> {
  const { mirrorRemoteAsset: mirror } = await import("./assetStore");
  return mirror(url, options);
}
