"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { Button } from "@/components/common/Button";
import { useTheme } from "@/hooks/useTheme";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { useHealth } from "@/hooks/useHealth";
import type { Health } from "@/hooks/useHealth";
import type { WebMCPAvailability } from "@/hooks/useWebMCP";

export type MobileView = "workspace" | "agents" | "brief";

export function TopNav({
  webmcp,
  mobileView,
  onMobileViewChange,
}: {
  webmcp: WebMCPAvailability;
  mobileView: MobileView;
  onMobileViewChange: (v: MobileView) => void;
}) {
  const projectName = useStudioStore((s) => s.project.name);
  const setProjectMeta = useStudioStore((s) => s.setProjectMeta);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme, mounted } = useTheme();
  const [shareCopied, setShareCopied] = useState(false);
  const health = useHealth();

  useEffect(() => {
    setDraft(projectName);
  }, [projectName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = draft.trim() || "Untitled";
    setProjectMeta({ name: next });
    setDraft(next);
    setEditing(false);
  }

  function handleShare() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (url && navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1500);
      }
    } catch {}
  }

  return (
    <header className="shrink-0 px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4">
      {/* Floating glass pill — highend.md §3.A "Fluid Island Nav" pattern.
          Detached from the top, full-width up to xl, then narrows to a
          content-sized pill on ultra-wide viewports. */}
      <div className="bezel-shell mx-auto flex h-12 w-full max-w-[1400px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="h-5 w-5 rounded-md"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-info))",
              }}
              aria-hidden
            />
            <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">
              Creative Studio
            </span>
          </div>

          <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden>
            /
          </span>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Project:</span>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(projectName);
                    setEditing(false);
                  }
                }}
                className="min-w-0 max-w-xs rounded-md border border-border bg-input px-2 py-1 text-sm font-medium text-foreground"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="min-w-0 truncate rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground hover:bg-muted"
                title="Rename project"
              >
                {projectName}
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <MobileTabs value={mobileView} onChange={onMobileViewChange} />

          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success status-dot-pulse" />
            Live
          </div>

          <StorageIndicators health={health} />

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            aria-label="Share project"
            className="hidden sm:inline-flex"
          >
            {shareCopied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <ShareIcon className="h-3.5 w-3.5" />
                Share
              </>
            )}
          </Button>

          <WebMCPIndicator status={webmcp} />

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-base active:scale-[0.94] hover:bg-muted hover:text-foreground"
          >
            {mounted && theme === "dark" ? (
              <SunIcon className="h-3.5 w-3.5" />
            ) : (
              <MoonIcon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileTabs({ value, onChange }: { value: MobileView; onChange: (v: MobileView) => void }) {
  return (
    <div
      className="flex h-7 items-center rounded-full border border-border bg-muted p-0.5 text-[10px] font-medium uppercase tracking-[0.08em] lg:hidden"
      role="tablist"
    >
      {([
        ["workspace", "Studio"],
        ["agents", "Agents"],
        ["brief", "Brief"],
      ] as [MobileView, string][]).map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            "h-6 rounded-full px-2.5 transition-[background-color,color,transform,box-shadow] duration-500 ease-apple",
            value === v
              ? "bg-card text-foreground shadow-studio-sm"
              : "text-muted-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StorageIndicators({ health }: { health: Health | null }) {
  const r2 = health?.r2;
  const supabase = health?.supabase;

  return (
    <>
      <div
        className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground 2xl:flex"
        title={
          r2?.configured
            ? `Media stored in Cloudflare R2 bucket "${r2.bucket}".`
            : "Media falls back to local-disk (public/assets/). Set R2_BUCKET + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY to activate."
        }
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: r2?.configured ? "var(--color-success)" : "var(--color-warning)" }}
          aria-hidden
        />
        R2{r2?.configured && r2.bucket ? ` · ${r2.bucket}` : ""}
      </div>
      <div
        className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground 2xl:flex"
        title={
          supabase?.configured
            ? `State synced to Supabase (${supabase.url ?? "project"}).`
            : "Durable state falls back to .studio-state.json. Add SUPABASE_URL + SUPABASE_SECRET_KEY to activate."
        }
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: supabase?.configured ? "var(--color-success)" : "var(--color-warning)" }}
          aria-hidden
        />
        Supabase
      </div>
    </>
  );
}

function WebMCPIndicator({ status }: { status: WebMCPAvailability }) {
  const label =
    status === "available"
      ? "WebMCP ready"
      : status === "checking"
      ? "Checking WebMCP…"
      : "WebMCP not detected";
  const color =
    status === "available"
      ? "var(--color-success)"
      : status === "checking"
      ? "var(--color-warning)"
      : "var(--color-muted-foreground)";
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground xl:flex"
      title={
        status === "available"
          ? "Tools are registered on document.modelContext — any WebMCP-capable agent can drive the studio."
          : status === "checking"
          ? "Looking for document.modelContext…"
          : "Open this page in Chrome 149+ with the WebMCP origin trial to register tools on document.modelContext."
      }
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
