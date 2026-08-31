"use client";

import { useEffect, useState } from "react";

interface Health {
  mode: "demo" | "live";
  demoMode: boolean;
  demoAllowed: boolean;
  ffmpegAvailable: boolean;
  capabilities: Record<
    string,
    { provider: string; available: boolean; reason?: string }
  >;
  r2?: {
    configured: boolean;
    bucket: string | null;
    publicUrl: string | null;
  };
  supabase?: {
    configured: boolean;
    url: string | null;
  };
}

let cached: Health | null = null;
let pending: Promise<Health | null> | null = null;

async function fetchHealth(): Promise<Health | null> {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) return null;
      cached = (await res.json()) as Health;
      return cached;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/**
 * Returns the live capability report from /api/health. Polls once on
 * mount. Returns null while loading and also if /api/health is
 * unreachable (e.g. during SSR or in offline dev mode).
 */
export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(cached);
  useEffect(() => {
    let cancelled = false;
    fetchHealth().then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return health;
}

export type { Health };
