"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { VideoPreview } from "./VideoPreview";
import { StoryboardGrid } from "./StoryboardGrid";
import { ScriptEditor } from "./ScriptEditor";
import { AudioWaveform } from "./AudioWaveform";
import { TimelineView } from "./TimelineView";
import { TimelineStrip } from "./TimelineStrip";
import { GridIcon, DocIcon, WaveIcon, BarsIcon } from "@/components/icons/UIIcons";
import { useSyncedPlayback } from "@/lib/hooks/useSyncedPlayback";

type TabId = "storyboard" | "script" | "audio" | "timeline";

const TABS: { id: TabId; label: string; icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: "storyboard", label: "Storyboard", icon: GridIcon },
  { id: "script", label: "Script", icon: DocIcon },
  { id: "audio", label: "Audio", icon: WaveIcon },
  { id: "timeline", label: "Timeline", icon: BarsIcon },
];

/** Direction of the slide-in animation when a tab becomes active.
 *  "forward" = the new tab is to the right of the previous one, so the
 *  panel slides in from the left edge (positive x -> 0). "back" is the
 *  reverse. */
type SlideDir = "forward" | "back";

const PREVIEW_MIN_PCT = 30;
const PREVIEW_MAX_PCT = 75;
const SPLIT_STORAGE_KEY = "studio:preview-split-pct";
/** Horizontal pointer travel (px) before a swipe commits to a tab change. */
const SWIPE_THRESHOLD_PX = 60;

/**
 * Side-by-side workspace:
 *
 *   �────────────────────────────┬─────────────────────────┐
 *   │                            │  [Tabs]                  │
 *   │                            ├─────────────────────────┤
 *   │      Program Preview       │                         │
 *   │           (16:9)            │   Storyboard / Script   │
 *   │                            │   / Audio / Timeline    │
 *   │                            │                         │
 *   ├────────────────────────────┤                         │
 *   │  ▓▓▓ transport ▓�▓          │                         │
 *   └────────────────────────────┴─────────────────────────┘
 *
 * The preview takes the full height of the workspace (left column),
 * with the timeline strip below it. The tabbed panel sits to the
 * right and stretches the full height. This is the layout used by
 * Figma, Notion, and most modern creative tools — and it gives the
 * preview a much taller canvas than the previous stacked layout.
 *
 * Tab navigation supports three gestures, all of which animate with
 * the same slide direction so the panel feels like one continuous
 * surface that slides between tabs:
 *
 *   1. Click a tab header.
 *   2. Press ← / → / Home / End with focus on the tab strip
 *      (WAI-ARIA tabs pattern).
 *   3. Horizontal swipe (pointer drag) on the tab panel content.
 */
export function Workspace() {
  const [tab, setTab] = useState<TabId>("storyboard");
  const [previewPct, setPreviewPct] = useState<number>(58);
  const [dragging, setDragging] = useState(false);
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<SlideDir>("forward");
  const playback = useSyncedPlayback();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    storyboard: null,
    script: null,
    audio: null,
    timeline: null,
  });
  // Swipe state lives in refs so pointermove doesn't re-render the tree.
  const swipeRef = useRef<{ startX: number; pointerId: number | null } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    if (Number.isFinite(stored)) {
      setPreviewPct(Math.min(PREVIEW_MAX_PCT, Math.max(PREVIEW_MIN_PCT, stored)));
    }
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPreviewPct(Math.min(PREVIEW_MAX_PCT, Math.max(PREVIEW_MIN_PCT, pct)));
  }, []);

  const endDrag = useCallback(() => {
    setDragging(false);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  }, [onPointerMove]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [onPointerMove, endDrag]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(previewPct));
  }, [previewPct]);

  useEffect(() => () => endDrag(), [endDrag]);

  /** Move to a new tab and arm the slide-in animation in the right
   *  direction. Always bumps `slideKey` so the CSS animation replays
   *  even if you toggle to the same tab twice. */
  const goToTab = useCallback(
    (next: TabId, dir: SlideDir) => {
      setTab((current) => {
        if (current !== next) setSlideDir(dir);
        return next;
      });
      setSlideKey((k) => k + 1);
    },
    []
  );

  /** Compute the direction a tab change *should* animate in based on
   *  the positions of the two tabs in the TABS array. */
  const directionFor = useCallback((from: TabId, to: TabId): SlideDir => {
    const a = TABS.findIndex((t) => t.id === from);
    const b = TABS.findIndex((t) => t.id === to);
    return b > a ? "forward" : "back";
  }, []);

  /** Tab strip keyboard handler — WAI-ARIA tabs pattern. */
  const onTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const i = TABS.findIndex((t) => t.id === tab);
      if (i < 0) return;
      let nextIdx = i;
      if (e.key === "ArrowRight") nextIdx = (i + 1) % TABS.length;
      else if (e.key === "ArrowLeft") nextIdx = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = TABS.length - 1;
      else return;
      e.preventDefault();
      const nextTab = TABS[nextIdx].id;
      goToTab(nextTab, directionFor(tab, nextTab));
      // Move focus to the newly active tab so the next arrow press lands
      // on it (roving tabindex pattern).
      tabRefs.current[nextTab]?.focus();
    },
    [tab, goToTab, directionFor]
  );

  // ── Swipe gesture on the tab panel ────────────────────────────────────────
  // We listen for horizontal pointer drag on the panel. A swipe that crosses
  // SWIPE_THRESHOLD_PX in either direction commits to the next/prev tab and
  // animates with the matching slide direction. Vertical drags and short
  // drags are ignored so scroll-y inside the panel still works.
  //
  // Two things make this reliable where the previous version felt dead:
  //   • `touch-action: pan-y` on the panel tells the browser that horizontal
  //     drags belong to us (gesture), while vertical drags stay native
  //     scroll. Without it the browser assumes every pan could be a scroll
  //     and fires `pointercancel` to take the gesture over — dropping the
  //     swipe before it ever crosses the threshold (why trackpad/touch
  //     swipes appeared to do nothing).
  //   • We commit the tab change *live* during `pointermove` the moment the
  //     threshold is crossed, and only navigate via a real pointer release.
  //     A late `pointercancel` therefore can't eat a completed swipe. We
  //     also draw the panel along under the pointer for live feedback and
  //     call `setPointerCapture` so move/up stay bound to the panel even if
  //     the finger leaves it.

  const [dragX, setDragX] = useState<number | null>(null);

  const onPanelPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only treat the primary button / touch / pen as a swipe candidate.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Don't start a swipe whose gesture belongs to a scrollable child
    // (inputs, textareas, rows). Let those receive the drag normally.
    if ((e.target as HTMLElement).closest("input, textarea, select, [data-no-swipe]")) return;
    swipeRef.current = { startX: e.clientX, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragX(0);
  }, []);

  const commitSwipe = useCallback(
    (dx: number) => {
      swipeRef.current = null;
      setDragX(null);
      const i = TABS.findIndex((t) => t.id === tab);
      if (i < 0) return;
      // Swipe left (negative dx) = go forward (next tab to the right).
      // Swipe right (positive dx) = go back (prev tab to the left).
      const target = dx < 0 ? Math.min(i + 1, TABS.length - 1) : Math.max(i - 1, 0);
      if (target === i) return;
      const nextTab = TABS[target].id;
      goToTab(nextTab, directionFor(tab, nextTab));
    },
    [tab, goToTab, directionFor]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: PointerEvent) => {
      const s = swipeRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      // Live-drag feedback: slide the panel under the finger.
      setDragX(dx);
      // Commit the moment we cross the threshold so a scroll-hijacking
      // `pointercancel` can't drop a completed swipe. We keep the panel
      // where it is here — goToTab's slide-in animation takes over.
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        commitSwipe(dx);
      }
    };
    const onUp = (e: PointerEvent) => {
      const s = swipeRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      // If we never crossed the threshold live (e.g. a fast flick that
      // skipped a move), decide here on release.
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) commitSwipe(dx);
      else swipeRef.current = null;
      setDragX(null);
    };
    const onCancel = (e: PointerEvent) => {
      const s = swipeRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      // If the browser stole the gesture for scrolling only *after* we
      // already committed live, there's nothing left to do — the swipe
      // already happened. Otherwise just bail out and snap back.
      if (Math.abs(e.clientX - s.startX) >= SWIPE_THRESHOLD_PX) commitSwipe(e.clientX - s.startX);
      else swipeRef.current = null;
      setDragX(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [tab, goToTab, directionFor, commitSwipe]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3 lg:p-4">
      {/* Side-by-side on lg+: preview (with transport) | splitter | tab panel */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row"
        style={{ "--preview-pct": `${previewPct}%` } as React.CSSProperties}
      >
        {/* Left column: preview + transport strip. */}
        <div className="flex min-h-0 w-full flex-col gap-2 lg:w-auto lg:grow-0 lg:basis-[var(--preview-pct)] lg:max-w-[var(--preview-pct)]">
          <div className="min-h-0 flex-1">
            <VideoPreview playback={playback} />
          </div>
          <div className="h-[52px] shrink-0">
            <TimelineStrip />
          </div>
        </div>

        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(previewPct)}
          aria-valuemin={PREVIEW_MIN_PCT}
          aria-valuemax={PREVIEW_MAX_PCT}
          onPointerDown={startDrag}
          onDoubleClick={() => setPreviewPct(58)}
          className={clsx(
            "group relative z-10 hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center lg:flex",
            dragging && "bg-primary/10"
          )}
          title="Drag to resize preview — double-click to reset"
        >
          <span
            className={clsx(
              "h-8 w-1 rounded-full transition-colors",
              dragging ? "bg-primary" : "bg-border group-hover:bg-foreground/30"
            )}
          />
        </div>

        {/* Right column: tabbed panel. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-studio border border-border bg-card shadow-studio-sm">
          <div
            role="tablist"
            aria-label="Workspace tabs"
            onKeyDown={onTabKeyDown}
            className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-card px-2"
          >
            <button
              type="button"
              aria-label="Previous tab"
              title="Previous tab"
              onClick={() => {
                const i = TABS.findIndex((t) => t.id === tab);
                const prev = TABS[(i - 1 + TABS.length) % TABS.length].id;
                goToTab(prev, directionFor(tab, prev));
              }}
              className="mr-0.5 flex h-8 w-7 items-center justify-center rounded-md text-[13px] font-medium tracking-tight text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-[0.95]"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next tab"
              title="Next tab"
              onClick={() => {
                const i = TABS.findIndex((t) => t.id === tab);
                const next = TABS[(i + 1) % TABS.length].id;
                goToTab(next, directionFor(tab, next));
              }}
              className="mr-1 flex h-8 w-7 items-center justify-center rounded-md text-[13px] font-medium tracking-tight text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-[0.95]"
            >
              →
            </button>
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`tabpanel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => goToTab(t.id, directionFor(tab, t.id))}
                  className={clsx(
                    "relative flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors active:scale-[0.97]",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  )}
                >
                  <Icon
                    className={clsx(
                      "h-3.5 w-3.5",
                      active
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  {t.label}
                  <span
                    className={clsx(
                      "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                      active ? "bg-primary" : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </div>
          <div
            key={slideKey}
            onPointerDown={onPanelPointerDown}
            className={clsx(
              "min-h-0 flex-1 overflow-auto bg-background",
              // Reserve only horizontal drags for the swipe gesture; vertical
              // panning stays native scroll. Without this the browser's
              // scroll-hijacking fires `pointercancel` and eats the swipe.
              "touch-pan-y",
              // Replay the slide-in animation on every tab change. We animate
              // a single transform property (no `transition-all` per the
              // design contract). The keyframe `workspace-tab-in` is defined
              // inline below so this stays self-contained.
              dragX === null && (slideDir === "forward" ? "anim-tab-in-forward" : "anim-tab-in-back")
            )}
            style={
              dragX !== null
                ? { transform: `translate3d(${dragX}px, 0, 0)`, transition: "none" }
                : undefined
            }
            role="tabpanel"
            id={`tabpanel-${tab}`}
            aria-label={`${tab} tab panel`}
          >
            {tab === "storyboard" && <StoryboardGrid />}
            {tab === "script" && <ScriptEditor />}
            {tab === "audio" && <AudioWaveform playback={playback} />}
            {tab === "timeline" && <TimelineView />}
          </div>
        </div>
      </div>

      {/* Slide-in keyframes. The two animations start at +12px / -12px
          respectively and ease back to 0 with the studio's spring-like
          easing. They only animate `transform` — width/height/opacity
          are untouched, so the panel never flashes. */}
      <style jsx global>{`
        @keyframes workspace-tab-in-forward {
          from { transform: translate3d(12px, 0, 0); opacity: 0.6; }
          to   { transform: translate3d(0,    0, 0); opacity: 1; }
        }
        @keyframes workspace-tab-in-back {
          from { transform: translate3d(-12px, 0, 0); opacity: 0.6; }
          to   { transform: translate3d(0,     0, 0); opacity: 1; }
        }
        .anim-tab-in-forward {
          animation: workspace-tab-in-forward 220ms cubic-bezier(0.2, 0, 0, 1);
          will-change: transform, opacity;
        }
        .anim-tab-in-back {
          animation: workspace-tab-in-back 220ms cubic-bezier(0.2, 0, 0, 1);
          will-change: transform, opacity;
        }
      `}</style>
    </section>
  );
}
