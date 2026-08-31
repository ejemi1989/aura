"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon } from "@/components/icons/UIIcons";

/**
 * Compact horizontal timeline strip — sits between the preview and
 * the tabbed panel. Gives the user a visual sense of scene order, a
 * playhead they can drag, and transport controls. This is NOT a
 * full Premiere-style multi-track editor; it's a thin playhead bar
 * that complements the preview without taking over the screen.
 */
export function TimelineStrip() {
  const scenes = useStudioStore((s) => s.project.scenes);
  // (music track row removed — voiceover is the sole audio layer)
  const playhead = useStudioStore((s) => s.playheadSeconds);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const selectedSceneId = useStudioStore((s) => s.selectedSceneId);
  const selectScene = useStudioStore((s) => s.selectScene);
  const trackRef = useRef<HTMLDivElement>(null);

  // Scrubbing state — when the user pointerdowns on the playhead we
  // pause audio playback so dragging doesn't fight with the rAF tick,
  // and capture the was-playing flag so we can resume on pointerup.
  // `isScrubbingRef` is the synchronous source of truth for drag
  // gating (read inside pointermove/pointerup handlers), while
  // `isScrubbing` is the React state that drives the cursor style.
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const totalDuration = useMemo(() => {
    const fromScenes = scenes.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
    return fromScenes || 30;
  }, [scenes]);

  // Scene start times (cumulative)
  const sceneStarts = useMemo(() => {
    const starts: Record<string, number> = {};
    let acc = 0;
    for (const s of scenes) {
      starts[s.id] = acc;
      acc += s.durationSeconds ?? 0;
    }
    return starts;
  }, [scenes]);

  // Convert clientX → playhead seconds. Shared by click-to-seek and
  // drag-to-scrub so both feel identical.
  const xToSeconds = useCallback(
    (clientX: number, rect: DOMRect | undefined) => {
      const el = trackRef.current;
      if (!el) return playhead;
      const r = rect ?? el.getBoundingClientRect();
      if (r.width <= 0) return playhead;
      const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return ratio * totalDuration;
    },
    [playhead, totalDuration],
  );

  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const seconds = xToSeconds(e.clientX, rect);
    setPlayhead(seconds);
  }

  // Drag handlers — attached to the playhead marker. We use Pointer
  // Events so the same code works on mouse + touch + pen. Capture
  // happens on pointerdown so a fast drag doesn't lose the up-event
  // when the cursor leaves the marker.
  function onPlayheadPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (scenes.length === 0 || totalDuration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    wasPlayingRef.current = isPlaying;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    if (isPlaying) setIsPlaying(false);
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      /* not supported in synthetic events */
    }
    const rect = trackRef.current?.getBoundingClientRect();
    setPlayhead(xToSeconds(e.clientX, rect));
  }

  function onPlayheadPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbingRef.current) return;
    const rect = trackRef.current?.getBoundingClientRect();
    setPlayhead(xToSeconds(e.clientX, rect));
  }

  function onPlayheadPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (wasPlayingRef.current) {
      setIsPlaying(true);
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-studio border border-border bg-card shadow-studio-sm">
      {/* Ruler row — SMPTE-style HH:MM:SS ticks */}
      <div className="flex h-5 shrink-0 items-center border-b border-border bg-background/70 text-[9px] font-mono text-muted-foreground">
        <div className="flex h-full w-9 shrink-0 items-center justify-center border-r border-border text-[8px] uppercase tracking-wider text-muted-foreground/70">
          TC
        </div>
        <div
          ref={trackRef}
          onClick={onTrackClick}
          className="relative h-full flex-1 cursor-pointer overflow-hidden"
          role="slider"
          aria-label="Playhead position"
          aria-valuemin={0}
          aria-valuemax={totalDuration}
          aria-valuenow={playhead}
        >
          {scenes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[10px]">
              Run the studio to populate the timeline
            </div>
          ) : (
            <TimelineRuler
              totalDuration={totalDuration}
              playhead={playhead}
            />
          )}
        </div>
      </div>

      {/* Scene track — video row */}
      <div className="flex min-h-0 flex-1">
        <div className="flex w-9 shrink-0 flex-col items-center justify-center border-r border-border bg-background/40 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          V1
        </div>
        <div
          ref={trackRef}
          onClick={onTrackClick}
          className="relative h-full flex-1 cursor-pointer overflow-hidden bg-background"
        >
          {scenes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
              Run the studio to populate the timeline
            </div>
          ) : (
            <div className="flex h-full">
              {scenes.map((s) => {
                const dur = s.durationSeconds ?? 4;
                const start = sceneStarts[s.id] ?? 0;
                const widthPct = (dur / totalDuration) * 100;
                const selected = selectedSceneId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectScene(s.id);
                      setPlayhead(start);
                    }}
                    className={clsx(
                      "group relative h-full overflow-hidden border-r border-card transition-base last:border-r-0",
                      selected
                        ? "bg-primary/20"
                        : "bg-muted hover:bg-primary/10"
                    )}
                    style={{ width: `${widthPct}%` }}
                    title={`Scene ${s.index}: ${s.description.slice(0, 50)}…`}
                  >
                    {s.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.imageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-55"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="relative flex h-full flex-col justify-between px-1.5 py-1 text-white">
                      <div className="flex items-center justify-between gap-1">
                        <span className="rounded bg-black/60 px-1 text-[8px] font-bold uppercase tracking-wider ring-1 ring-white/15">
                          S{s.index}
                        </span>
                        <span className="font-mono text-[8px] tabular-nums opacity-90">
                          {fmtTime(dur)}
                        </span>
                      </div>
                      <span className="truncate text-[9px] font-semibold opacity-95">
                        {(s.caption && s.caption.trim() && s.caption !== "Scene" ? s.caption : s.description.split(".")[0]).slice(0, 36)}
                      </span>
                    </div>
                    {selected && (
                      <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Audio track row — waveforms under each scene block */}
      <div className="flex h-7 shrink-0 border-t border-border">
        <div className="flex w-9 shrink-0 items-center justify-center border-r border-border bg-background/40 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          A1
        </div>
        <div className="relative h-full flex-1 overflow-hidden bg-background">
          {scenes.length > 0 ? (
            <div className="flex h-full">
              {scenes.map((s) => {
                const dur = s.durationSeconds ?? 4;
                const widthPct = (dur / totalDuration) * 100;
                const seed = parseInt(s.id.replace(/\D/g, ""), 10) || 1;
                return (
                  <div
                    key={s.id}
                    className="relative h-full border-r border-border/70 last:border-r-0"
                    style={{ width: `${widthPct}%` }}
                  >
                    <MiniWaveform
                      bars={64}
                      seed={seed}
                      hasVoice={!!s.voiceoverUrl}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Playhead line — sits BELOW the TC ruler so the SMPTE labels
          stay readable, and spans the V1 + A1 media tracks. A small
          diamond marker sits at the top of V1 to anchor it visually.
          Both are wrapped in a wider hit area so the user can grab
          the playhead with the mouse without pixel-hunting the 2px
          red line. */}
      {scenes.length > 0 && totalDuration > 0 && (
        <>
          {/* Hit area — invisible 14px-wide strip that captures the
              pointer so dragging works. Sits ABOVE the line+marker so
              it owns the pointer events. */}
          <div
            role="slider"
            aria-label="Scrub playhead"
            aria-valuemin={0}
            aria-valuemax={totalDuration}
            aria-valuenow={playhead}
            tabIndex={0}
            onPointerDown={onPlayheadPointerDown}
            onPointerMove={onPlayheadPointerMove}
            onPointerUp={onPlayheadPointerUp}
            onPointerCancel={onPlayheadPointerUp}
            className={clsx(
              "absolute z-30 cursor-grab select-none",
              isScrubbing && "cursor-grabbing",
            )}
            style={{
              left: `calc(${(playhead / totalDuration) * 100}% - 7px)`,
              top: "16px",
              bottom: "0",
              width: "14px",
            }}
          >
            {/* Visible red line — only 2px wide, centered in the hit area. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bg-danger"
              style={{
                top: "4px",
                bottom: "0",
                width: "2px",
                boxShadow: "0 0 4px var(--color-danger)",
              }}
            />
            {/* Diamond marker at the top of the playhead — visual anchor. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-danger"
              style={{
                top: "0px",
                boxShadow: "0 0 4px var(--color-danger)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** SMPTE-style timecode ruler with major (every second) and minor (every 0.5s) ticks. */
function TimelineRuler({ totalDuration, playhead }: { totalDuration: number; playhead: number }) {
  const majorEvery = 5;
  const minorEvery = 1;
  const totalSecs = Math.max(1, Math.ceil(totalDuration));
  return (
    <div className="relative h-full">
      {/* Tick lines */}
      {Array.from({ length: totalSecs + 1 }).map((_, i) => {
        const sec = i;
        const left = (sec / totalDuration) * 100;
        const isMajor = sec % majorEvery === 0;
        const isPlayhead = Math.abs(sec - playhead) < 0.5;
        return (
          <div
            key={i}
            className={clsx(
              "absolute top-0 flex h-full flex-col items-start",
              isPlayhead && "z-10",
            )}
            style={{ left: `${left}%` }}
          >
            <span
              className={clsx(
                "block w-px",
                isMajor ? "h-2.5 bg-foreground/40" : "h-1.5 bg-foreground/15",
              )}
            />
            {isMajor && (
              <span className="ml-1 -translate-y-3 font-mono text-[8px] tabular-nums text-muted-foreground">
                {fmtRulerLabel(sec)}
              </span>
            )}
          </div>
        );
      })}
      {/* Minor half-second ticks */}
      {Array.from({ length: totalSecs }).map((_, i) => {
        const sec = i + minorEvery * 0.5;
        const left = (sec / totalDuration) * 100;
        return (
          <span
            key={`m${i}`}
            className="absolute top-0 h-1 w-px bg-foreground/10"
            style={{ left: `${left}%` }}
          />
        );
      })}
    </div>
  );
}

function fmtRulerLabel(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MiniWaveform({ bars, seed, hasVoice }: { bars: number; seed: number; hasVoice: boolean }) {
  const heights = useMemo(() => {
    const arr: number[] = [];
    let h = seed * 9301 + 49297;
    const rnd = () => {
      h = (h * 9301 + 49297) % 233280;
      return h / 233280;
    };
    for (let i = 0; i < bars; i++) {
      const v = (Math.sin(seed + (i / bars) * Math.PI * 3.2) + 1) / 2;
      const n = rnd();
      arr.push(Math.max(0.08, v * 0.6 + n * 0.4));
    }
    return arr;
  }, [bars, seed]);
  return (
    <div className="flex h-full items-center gap-[1px] px-1">
      {heights.map((v, i) => (
        <span
          key={i}
          className={clsx(
            "w-[2px] rounded-[0.5px]",
            hasVoice ? "bg-primary/55" : "bg-foreground/15",
          )}
          style={{ height: `${v * 100}%` }}
        />
      ))}
    </div>
  );
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
