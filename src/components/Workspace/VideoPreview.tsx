"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStudioStore } from "@/lib/store/useStudioStore";
import type { SyncedPlayback } from "@/lib/hooks/useSyncedPlayback";
import {
  hasDownloadableMp4,
  downloadUrl,
  exportManifestAsVideo,
} from "@/lib/exportVideo";
import { Spinner } from "@/components/common/Spinner";
import { Badge } from "@/components/common/Badge";
import { MotionGraphicsOverlay } from "./MotionGraphics/MotionGraphicsOverlay";

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** SMPTE-style timecode HH:MM:SS:FF (FF = 1/30s frames for video-rate feel). */
function fmtTC(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec - Math.floor(sec)) * 30);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

/** Cumulative start time of `target` within the scene list. */
function sceneStartForCurrent(target: { id: string }, scenes: { id: string; durationSeconds?: number }[]): number {
  let acc = 0;
  for (const s of scenes) {
    if (s.id === target.id) return acc;
    acc += s.durationSeconds ?? 0;
  }
  return 0;
}

/**
 * Big, clean preview. 16:9, dark stage, follows the timeline playhead.
 * No full-bleed play button overlay — the small play affordance sits
 * in the bottom-left corner so scene captions and the slate stay
 * visible at all times.
 */
export function VideoPreview({ playback }: { playback: SyncedPlayback }) {
  const project = useStudioStore((s) => s.project);
  const {
    isPlaying,
    setIsPlaying,
    setPlayhead,
    playhead,
    audioElement,
    playFromClick,
  } = playback;
  const [hovering, setHovering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  // Pass 35: motion graphics toggle. Default ON so the studio ships
  // looking animated out of the box. The user can flip it off to see
  // the raw stills (handy for QA / debugging).
  const [motionGraphicsEnabled, setMotionGraphicsEnabled] = useState(true);
  const [composedFailed, setComposedFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isManifest = project.composedVideoUrl === "__manifest__";
  const hasComposedVideo =
    !!project.composedVideoUrl && project.composedVideoUrl !== "__manifest__" && !composedFailed;
  const isRendering = project.phase === "assembly" && !hasComposedVideo;

  // The current scene under the playhead — used for the "what frame is
  // the user looking at right now" view when there's no composed video.
  const currentScene = useMemo(() => {
    let acc = 0;
    for (const s of project.scenes) {
      const dur = s.durationSeconds ?? 0;
      if (playhead >= acc && playhead < acc + dur) return s;
      acc += dur;
    }
    return project.scenes[0] ?? null;
  }, [project.scenes, playhead]);

  const totalDuration = useMemo(() => {
    const fromScenes = project.scenes.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
    return fromScenes || project.brief?.targetDurationSeconds || 30;
  }, [project.scenes, project.brief]);

  // When we have a real video, drive its currentTime from the playhead
  // so scrubbing the timeline strip updates the visible frame.
  useEffect(() => {
    if (hasComposedVideo && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - playhead) > 0.25) {
        try {
          videoRef.current.currentTime = playhead;
        } catch {}
      }
    }
  }, [playhead, hasComposedVideo]);

  function handlePlayPause() {
    if (hasComposedVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      const next = !isPlaying;
      setIsPlaying(next);
      if (next) {
        // Synchronous .play() from the user gesture so the browser's
        // autoplay policy actually lets the spoken audio be heard.
        playFromClick();
      }
    }
  }

  // Export is available once there's either a real composed mp4 (ffmpeg
  // host) or at least one scene clip (browser-stitched fallback).
  const hasSceneClips = project.scenes.some((s) => s.videoUrl);
  const canExport = hasDownloadableMp4(project) || hasSceneClips;

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportNote(null);
    try {
      let outcome;
      if (hasDownloadableMp4(project)) {
        const filename = `${project.name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "creative-studio-export"}.mp4`;
        await downloadUrl(project.composedVideoUrl!, filename);
        outcome = { ok: true, message: "MP4 downloaded.", mode: "mp4" as const };
      } else {
        outcome = await exportManifestAsVideo(project, {
          onProgress: () => {},
        });
      }
      if (!outcome.ok) {
        setExportNote(outcome.message);
      }
    } catch (err) {
      setExportNote(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      useStudioStore.getState().logActivity("video-editor", "error", `Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      className="flex h-full w-full flex-col overflow-hidden rounded-studio border border-border bg-card shadow-studio-md"
      aria-label="Preview"
    >
      {/* Title bar — like a video editor window header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-3 text-[11px] font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold tracking-wide text-foreground/80">Program Monitor</span>
          {project.scenes.length > 0 && (
            <span className="text-muted-foreground/80">
              · {project.scenes.length} scene{project.scenes.length === 1 ? "" : "s"}
              {" · "}
              {fmtTime(totalDuration)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isManifest && <Badge tone="amber">Slideshow</Badge>}
          {hasComposedVideo && <Badge tone="green">Final cut</Badge>}
          <Badge tone="neutral">1080p · 16:9</Badge>
          <ExportButton
            canExport={canExport}
            exporting={exporting}
            onClick={handleExport}
          />
        </div>
      </div>

      {exportNote && (
        <div className="flex items-center gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <InfoIcon className="h-3 w-3 shrink-0" />
          <span>{exportNote}</span>
          <button
            onClick={() => setExportNote(null)}
            className="ml-auto shrink-0 rounded px-1 text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
            aria-label="Dismiss export notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Program stage — black background, 16:9 letterbox, safe-area guides */}
      <div
        className="group relative flex min-h-[260px] flex-1 items-stretch justify-center overflow-hidden bg-[#0a0a0a]"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Letterbox side bars (vertical) — only visible when stage is wider than 16:9 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[calc((100%-min(100%,calc(100vh*1.7778)))/2)] bg-black md:block" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[calc((100%-min(100%,calc(100vh*1.7778)))/2)] bg-black md:block" aria-hidden />

        <button
          type="button"
          onClick={handlePlayPause}
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
          className="relative flex h-full w-full cursor-pointer items-center justify-center p-3 lg:p-4"
        >
          <div className="relative flex h-full w-full items-center justify-center">
            {isRendering ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Spinner size={24} />
                <p className="text-sm">Rendering final cut…</p>
              </div>
            ) : hasComposedVideo ? (
              <div
                className="relative max-h-full max-w-full overflow-hidden rounded shadow-2xl shadow-black/60 ring-1 ring-black/40"
                style={{ aspectRatio: "16 / 9" }}
              >
                <video
                  ref={videoRef}
                  src={project.composedVideoUrl!}
                  poster={currentScene?.imageUrl ?? undefined}
                  className="h-full w-full object-cover"
                  controls={false}
                  onTimeUpdate={(e) => {
                    if (!isPlaying) return;
                    setPlayhead(e.currentTarget.currentTime);
                  }}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => setComposedFailed(true)}
                  playsInline
                />
                <SafeAreaGuides />
              </div>
            ) : currentScene ? (
              <div
                className="relative h-full w-full overflow-hidden rounded shadow-2xl shadow-black/60 ring-1 ring-black/40"
              >
                {/* Motion Graphics Overlay (Pass 35) — adds Ken Burns,
                    color grade, particles, kinetic text, and cinematic
                    transitions on top of the raw scene image/video. Keyed
                    to scene.id so React remounts on every scene change,
                    replaying the entry animations. The raw video/img is
                    rendered below this overlay when motionGraphicsEnabled
                    is false. */}
                {motionGraphicsEnabled && (currentScene.imageUrl || currentScene.videoUrl) ? (
                  <MotionGraphicsOverlay
                    key={`${currentScene.id}-mg`}
                    scene={currentScene}
                    totalDurationSeconds={totalDuration}
                    voiceoverLine={currentScene.voiceoverLine ?? currentScene.description}
                    brand={project.name}
                    beatName={currentScene.beatName ?? beatNameForIndex(currentScene.index)}
                  />
                ) : null}

                {/* Raw scene image — shown UNDER the motion graphics
                    overlay when motion is off. When motion is on, the
                    overlay renders its own image/video, so we skip this
                    to avoid double-rendering. */}
                {!motionGraphicsEnabled && currentScene.videoUrl &&
                !currentScene.videoUrl.endsWith(".png") &&
                !currentScene.videoUrl.endsWith(".jpg") &&
                currentScene.videoUrl !== "__no_video__" ? (
                  <video
                    key={`${currentScene.id}-raw`}
                    src={currentScene.videoUrl}
                    poster={currentScene.imageUrl ?? undefined}
                    className="h-full w-full object-cover"
                    autoPlay={isPlaying}
                    muted={isPlaying}
                    playsInline
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    ref={(el) => {
                      // Drive currentTime from the shared playhead so the
                      // video stays in sync with the voiceover.
                      if (!el) return;
                      const intra = playhead - sceneStartForCurrent(currentScene, project.scenes);
                      const dur = el.duration || currentScene.durationSeconds || 0;
                      if (dur > 0 && Math.abs(el.currentTime - intra) > 0.25) {
                        try {
                          el.currentTime = Math.max(0, Math.min(dur, intra));
                        } catch {}
                      }
                      if (isPlaying && el.paused) void el.play().catch(() => {});
                      if (!isPlaying && !el.paused) el.pause();
                    }}
                  />
                ) : !motionGraphicsEnabled && currentScene.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${currentScene.id}-raw`}
                    src={currentScene.imageUrl}
                    alt={currentScene.voiceoverLine ?? currentScene.description}
                    className="h-full w-full object-cover"
                  />
                ) : null}

                <SafeAreaGuides />

                {/* Loading state — only when there's no media at all. */}
                {!currentScene.videoUrl && !currentScene.imageUrl && (
                  <div className="flex h-full w-full items-center justify-center bg-background">
                    <Spinner size={20} />
                  </div>
                )}

                {/* Lower-third-style caption — sits below the motion
                    graphics overlay so MG's own caption overlays
                    (kinetic-caption) take priority. When motion is OFF
                    we keep the static caption here for readability. */}
                {!motionGraphicsEnabled && currentScene.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-4 pt-12">
                    <p className="text-center text-base font-semibold text-white drop-shadow-md">
                      {currentScene.caption}
                    </p>
                  </div>
                )}

                {/* Scene number badge — always visible so the user can
                    see "what scene am I watching" without ambiguity. */}
                <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                  Scene {currentScene.index}
                </div>

                {/* Motion Graphics toggle — small pill in the corner so
                    the user can A/B compare "with motion graphics" vs
                    "raw stills". Default ON.
                    Note: this button is a SIBLING of the play/pause
                    button (not nested inside it) — putting a button
                    inside a button triggers a React hydration warning
                    ("button cannot be a descendant of <button>") and
                    produces invalid HTML. */}
              </div>
            ) : (
              <div className="px-8 text-center text-muted-foreground">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background/60">
                  <VideoOffIcon className="h-7 w-7 opacity-40" />
                </div>
                <p className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-foreground/80">
                  Ready for production
                </p>
                <p className="mt-2 max-w-xs text-[11px] leading-relaxed opacity-80">
                  Stand by on the Program Monitor. Enter a brief and the crew will
                  populate this 16:9 frame — script, storyboard, key visuals, motion,
                  voice and captions, scene by scene.
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary dot-pulse" />
                  All 10 specialists on standby
                </p>
              </div>
            )}

            {currentScene && !isPlaying && (
              <span
                className={clsx(
                  "pointer-events-none absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-primary shadow-lg transition-base",
                  hovering ? "scale-105 opacity-100" : "opacity-80"
                )}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            )}
          </div>
        </button>

        {/* Motion Graphics toggle (sibling of the play button above —
            not nested, to keep HTML valid and React happy). Renders
            whenever there's a scene to preview so the user can A/B
            compare "with motion graphics" vs "raw stills". Default ON. */}
        {hasComposedVideo || currentScene ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMotionGraphicsEnabled((v) => !v);
            }}
            aria-pressed={motionGraphicsEnabled}
            title={motionGraphicsEnabled ? "Hide motion graphics" : "Show motion graphics"}
            className={clsx(
              "absolute right-3 top-3 z-30 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur transition-base",
              motionGraphicsEnabled
                ? "border border-primary/40 bg-primary/30 text-white shadow-md shadow-primary/20"
                : "border border-white/20 bg-black/55 text-white/85 hover:bg-black/70"
            )}
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", motionGraphicsEnabled ? "bg-white dot-pulse" : "bg-white/40")} />
            {motionGraphicsEnabled ? "MG ON" : "MG OFF"}
          </button>
        ) : null}

        {/* Audio VU meters — left + right channels on the right edge */}
        <div className="pointer-events-none absolute right-1 top-1/2 hidden -translate-y-1/2 flex-col gap-1 lg:flex">
          <VUChannel active={isPlaying} side="L" />
          <VUChannel active={isPlaying} side="R" />
        </div>

        {audioElement}
      </div>

      {/* Transport bar — large prominent controls like a real NLE */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <TransportIconButton
            label="Skip to start (Home)"
            onClick={() => setPlayhead(0)}
          >
            <SkipHomeIcon />
          </TransportIconButton>
          <TransportIconButton
            label="Step back one frame"
            onClick={() => setPlayhead(Math.max(0, playhead - 1 / 30))}
          >
            <StepBackIcon />
          </TransportIconButton>
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className={clsx(
              "mx-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full transition-base active:scale-95",
              isPlaying
                ? "bg-foreground text-background hover:bg-foreground/85"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/30"
            )}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1.2" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <TransportIconButton
            label="Step forward one frame"
            onClick={() =>
              setPlayhead(
                totalDuration > 0
                  ? Math.min(totalDuration, playhead + 1 / 30)
                  : playhead + 1 / 30,
              )
            }
          >
            <StepForwardIcon />
          </TransportIconButton>
          <TransportIconButton
            label="Skip to end (End)"
            onClick={() => setPlayhead(totalDuration)}
          >
            <SkipEndIcon />
          </TransportIconButton>
        </div>

        {/* SMPTE-style timecode display */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1 rounded bg-background px-2 py-1 ring-1 ring-border">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">TC</span>
            <span className="text-[12px] tabular-nums font-semibold text-foreground">
              {fmtTC(playhead)}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded bg-background px-2 py-1 ring-1 ring-border">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">DUR</span>
            <span className="text-[12px] tabular-nums font-medium text-foreground/85">
              {fmtTC(totalDuration)}
            </span>
          </div>
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isPlaying
                ? "bg-primary/15 text-primary"
                : "bg-background text-muted-foreground/70 ring-1 ring-border"
            )}
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                isPlaying ? "bg-primary dot-pulse" : "bg-muted-foreground/40"
              )}
            />
            {isPlaying ? "Play" : "Stop"}
          </span>
        </div>
      </div>
    </section>
  );
}

/** Safe-area corner brackets + crosshair, like a camera viewfinder / NLE monitor. */
function SafeAreaGuides() {
  return (
    <>
      {/* Crosshair */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.07]" />
        <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/[0.07]" />
      </div>
      {/* Corner brackets — action-safe (90%) */}
      <div className="pointer-events-none absolute inset-[5%]">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />
      </div>
    </>
  );
}

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const map = {
    tl: "left-0 top-0 border-l-2 border-t-2",
    tr: "right-0 top-0 border-r-2 border-t-2",
    bl: "left-0 bottom-0 border-l-2 border-b-2",
    br: "right-0 bottom-0 border-r-2 border-b-2",
  } as const;
  return (
    <span
      className={clsx(
        "absolute h-3 w-3 border-white/40",
        map[position],
      )}
      aria-hidden
    />
  );
}

/** Vertical VU meter — green safe zone, yellow headroom, red peak. */
function VUChannel({ active, side }: { active: boolean; side: "L" | "R" }) {
  // Pseudo-random level that "dances" while active.
  const levelSeed = side === "L" ? 0.7 : 0.62;
  const segments = 14;
  return (
    <div className="flex flex-col items-center gap-0.5 rounded bg-black/55 px-1 py-1.5 backdrop-blur">
      <span className="text-[8px] font-bold text-white/85">{side}</span>
      <div className="flex h-20 w-2 flex-col-reverse gap-[1px] overflow-hidden rounded-sm">
        {Array.from({ length: segments }).map((_, i) => {
          const seg = i / segments;
          const dance = active
            ? Math.max(
                0,
                Math.min(
                  1,
                  levelSeed * 0.6 +
                    Math.sin((Date.now() ?? 0) / 120 + i * 0.7) * 0.18 +
                    Math.sin((Date.now() ?? 0) / 220 + i * 1.3) * 0.12 +
                    (1 - seg) * 0.15,
                ),
              )
            : 0.18;
          const color =
            seg > 0.85
              ? "bg-red-500/90"
              : seg > 0.7
                ? "bg-amber-400/85"
                : "bg-emerald-400/80";
          return (
            <span
              key={i}
              className={clsx(
                "w-full transition-opacity duration-75",
                color,
              )}
              style={{ opacity: dance > seg ? 1 : 0.12, height: "6%" }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[8px] tabular-nums text-white/70">
        {active ? `${Math.round(levelSeed * -6 - 3)}` : `-∞`}
      </span>
    </div>
  );
}

function TransportIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-base hover:bg-background hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  );
}

function SkipHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <rect x="5" y="6" width="2" height="12" rx="0.6" />
      <path d="M20 6 10 12l10 6V6Z" />
    </svg>
  );
}
function SkipEndIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <rect x="17" y="6" width="2" height="12" rx="0.6" />
      <path d="M4 6v12l10-6L4 6Z" />
    </svg>
  );
}
function StepBackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path d="M19 5 9 12l10 7V5Z" />
      <rect x="5" y="5" width="2" height="14" rx="0.6" />
    </svg>
  );
}
function StepForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <path d="M5 5v14l10-7L5 5Z" />
      <rect x="17" y="5" width="2" height="14" rx="0.6" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m22 8-6 4 6 4V8Z" />
    </svg>
  );
}

function VideoOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" />
      <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function ExportButton({
  canExport,
  exporting,
  onClick,
}: {
  canExport: boolean;
  exporting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canExport || exporting}
      title={
        canExport
          ? "Export final video"
          : "Run the studio and compose a video before exporting"
      }
      className={clsx(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wide transition-base",
        canExport
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          : "cursor-not-allowed border-border bg-background text-muted-foreground/50"
      )}
    >
      {exporting ? (
        <>
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-primary/40 border-t-primary" aria-hidden />
          Exporting…
        </>
      ) : (
        <>
          <DownloadIcon className="h-3 w-3" />
          Export MP4
        </>
      )}
    </button>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  );
}

/** Beat name by 1-based scene index — used by the motion graphics
 *  overlay to pick a transition and lower-third eyebrow when the
 *  scene's own beatName isn't populated yet. Mirrors the Scriptwriter's
 *  default beat order so the visual rhythm matches the script. */
function beatNameForIndex(i: number): string {
  const beats = ["Hook", "Setup", "Context", "Pain", "Promise", "Proof", "Objection", "Zoom"];
  return beats[(Math.max(1, i) - 1) % beats.length];
}
