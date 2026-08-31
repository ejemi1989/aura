"use client";

import { useState } from "react";
import clsx from "clsx";
import { useHealth } from "@/hooks/useHealth";

/**
 * Renders a single-line banner across the top of the page that
 * announces the studio is in demo mode, lists which providers are
 * real vs. placeholder, and links to the .env.example docs. Dismissable.
 *
 * Hidden when every provider is configured (live mode), so the banner
 * only adds noise when it's actually useful.
 */
export function DemoModeBanner() {
  const health = useHealth();
  const [dismissed, setDismissed] = useState(false);

  if (!health || !health.demoMode || dismissed) return null;

  const live: string[] = [];
  const demo: string[] = [];
  for (const [cap, info] of Object.entries(health.capabilities)) {
    if (info.available && info.provider !== "demo") live.push(`${cap} (${info.provider})`);
    else demo.push(cap);
  }

  return (
    <div
      role="status"
      className={clsx(
        "flex shrink-0 items-start gap-3 border-b border-warning/30 bg-warning/8 px-4 py-2 text-[12px]"
      )}
    >
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-3 w-3" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          Demo mode — running without any API keys
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {live.length > 0 && (
            <>
              <span className="text-success">Live:</span> {live.join(", ")}
              {" · "}
            </>
          )}
          {demo.length > 0 && (
            <>
              <span className="text-warning">Placeholder:</span>{" "}
              {demo.join(", ")}
            </>
          )}
          {!health.ffmpegAvailable && (
            <>
              {" · "}
              <span className="text-warning">ffmpeg not installed</span>
              {" (video compose will use scene manifest)"}
            </>
          )}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Copy <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">.env.example</code> to <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">.env.local</code> and add keys (e.g. <code className="rounded bg-background px-1 py-0.5 font-mono text-[10px]">OPENAI_API_KEY</code>) to swap placeholders for real models.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo mode banner"
        className="shrink-0 rounded p-1 text-muted-foreground transition-base hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-3.5 w-3.5" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
