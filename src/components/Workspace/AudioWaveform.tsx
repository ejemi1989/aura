"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { useStudioStore } from "@/lib/store/useStudioStore";
import type { SyncedPlayback } from "@/lib/hooks/useSyncedPlayback";

/**
 * Synced audio console. The playback engine lives in the (always-visible)
 * Program Monitor via the shared useSyncedPlayback hook; this panel is a
 * DAW-style mixer that reads the exact same store transport — so the audio
 * tracks and the video preview stay locked frame-for-frame. Controls here
 * just drive the shared isPlaying / playhead.
 */

const WAVEBARS = 144;
const TOTAL_BARS = 72;

// Deterministic pseudo-waveform per scene + a flat overall meter.
function sceneWave(id: string, seed: number, height = 26, bars = 40): number[] {
  const out: number[] = [];
  let h = seed * 9301 + 49297;
  const rnd = () => {
    h = (h * 9301 + 49297) % 233280;
    return h / 233280;
  };
  for (let i = 0; i < bars; i++) {
    const t = (i / bars) * Math.PI * 2.4;
    const v = (Math.sin(seed + t * 1.9) + 1) / 2;
    const noise = rnd();
    out.push(Math.max(0.14, v * 0.72 + noise * 0.28));
  }
  return out;
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** SMPTE-style HH:MM:SS:FF timecode. */
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

export function AudioWaveform({ playback }: { playback: SyncedPlayback }) {
  const scenes = useStudioStore((s) => s.project.scenes);
  const setProjectMeta = useStudioStore((s) => s.setProjectMeta);
  const {
    isPlaying,
    playhead,
    setPlayhead,
    setIsPlaying,
    currentScene,
    totalDuration,
    totalProgress,
    playFromClick,
  } = playback;

  const withVoiceover = useMemo(() => scenes.filter((s) => s.voiceoverUrl), [scenes]);
  const tracks = scenes.length ? scenes : withVoiceover;

  // Build the master strip: each scene contributes a proportional slice.
  const master = useMemo(() => {
    const slice = Math.max(1, Math.floor(TOTAL_BARS / Math.max(1, scenes.length)));
    const bars: number[] = [];
    scenes.forEach((s, si) => {
      const w = sceneWave(s.id ?? `s${si}`, si * 13 + 5, 26, Math.max(slice, 2)).slice(0, slice);
      while (w.length < slice) w.push(0.2);
      bars.push(...w);
    });
    return bars.slice(0, TOTAL_BARS);
  }, [scenes]);

  // Cumulative start of each scene (for the boundary ticks + seek).
  const starts = useMemo(() => {
    let acc = 0;
    return scenes.map((s) => {
      const start = acc;
      acc += s.durationSeconds ?? 0;
      return start;
    });
  }, [scenes]);

  const activeTrackIdx = currentScene
    ? scenes.findIndex((s) => s.id === currentScene.id)
    : -1;

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // If we're at the very end, restart from the top.
    if (totalDuration > 0 && playhead >= totalDuration - 0.05) setPlayhead(0);
    setIsPlaying(true);
    // Synchronous .play() from the user gesture so the browser autoplay
    // policy actually lets the spoken audio be heard.
    playFromClick();
  }

  function stop() {
    setIsPlaying(false);
    setPlayhead(0);
  }

  function seekScene(i: number) {
    const start = starts[i] ?? 0;
    const scene = scenes[i];
    setIsPlaying(false);
    setPlayhead(start);
    // Playing a specific track from its row: load + play it immediately.
    if (scene?.voiceoverUrl) {
      playFromClick(scene);
      setIsPlaying(true);
    }
  }

  function stepScene(delta: number) {
    const idx = activeTrackIdx === -1 ? 0 : activeTrackIdx;
    const next = Math.max(0, Math.min(scenes.length - 1, idx + delta));
    setIsPlaying(false);
    setPlayhead(starts[next] ?? 0);
  }

  const hasAnyVoice = withVoiceover.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header bar — like a video editor window */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-card px-3 text-[11px] font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <WaveIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold tracking-wide text-foreground/80">Audio Mixer</span>
          <span className="text-muted-foreground/80">
            · {tracks.length} track{tracks.length === 1 ? "" : "s"} · transport synced to preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
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

      {/* Transport bar — full NLE-style */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <TransportButton label="Previous scene (←)" onClick={() => stepScene(-1)} disabled={tracks.length === 0}>
            <SkipBackIcon />
          </TransportButton>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            className={clsx(
              "mx-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full transition-base active:scale-95",
              isPlaying
                ? "bg-foreground text-background hover:bg-foreground/85"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/30"
            )}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <TransportButton label="Stop" onClick={stop} disabled={!isPlaying && playhead === 0}>
            <StopIcon />
          </TransportButton>
          <TransportButton label="Next scene (→)" onClick={() => stepScene(1)} disabled={tracks.length === 0}>
            <SkipForwardIcon />
          </TransportButton>
        </div>

        <div className="flex items-center gap-2 font-mono">
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
        </div>

        {/* Master VU meter */}
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Master
          </span>
          <MasterMeter active={isPlaying} level={isPlaying ? 0.7 : 0} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        {/* Master waveform strip */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <WaveIcon className="h-3.5 w-3.5 text-primary" />
              Master Timeline
            </span>
            <span className="font-mono text-[9px] tabular-nums text-muted-foreground/80">
              {tracks.length} tracks
            </span>
          </div>
          <div className="relative h-16">
            <div className="flex h-full items-center gap-[1.5px]">
              {master.map((v, i) => (
                <div
                  key={i}
                  className="h-full flex-1 rounded-[1px] bg-gradient-to-t from-primary/25 to-primary/60"
                  style={{ transform: `scaleY(${0.25 + v * 0.75})`, transformOrigin: "center" }}
                />
              ))}
            </div>
            {/* Scene boundaries */}
            {scenes.length > 1 &&
              starts.slice(1).map((ts, i) => {
                const left = totalDuration > 0 ? (ts / totalDuration) * 100 : 0;
                return (
                  <div
                    key={`b${i}`}
                    className="absolute top-0 hidden h-full w-px bg-foreground/20"
                    style={{ left: `${left}%` }}
                  />
                );
              })}
            {/* Playhead cursor */}
            <div
              className="absolute top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-danger shadow-[0_0_6px_rgba(0,0,0,0.4)]"
              style={{ left: `${totalProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Track list */}
        <div className="flex flex-col gap-1.5">
          {tracks.length === 0 ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <MicOffIcon className="h-6 w-6 opacity-40" />
              <p>
                No voiceover yet. Run the voiceover agent (quick-goal box or the
                text_to_speech tool) — Speechify tracks will appear here.
              </p>
            </div>
          ) : (
            tracks.map((s, idx) => {
              const wave = sceneWave(s.id ?? `s${idx}`, idx * 19 + 11);
              const active = activeTrackIdx === idx;
              const inTotal = s.durationSeconds ?? 0;
              return (
                <button
                  key={s.id ?? idx}
                  type="button"
                  onClick={() => seekScene(idx)}
                  title="Click to seek the playhead to this scene (synced with the preview)"
                  className={clsx(
                    "group flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/[0.07]"
                      : "border-border bg-card hover:border-primary/40 hover:bg-background"
                  )}
                >
                  {/* Track number + mic icon — flashes "speaking" while
                      the voiceover for this scene is currently playing. */}
                  <span
                    className={clsx(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-md border transition-colors",
                      active && isPlaying && hasAnyVoice && s.voiceoverUrl
                        ? "border-primary bg-primary/20 text-primary"
                        : active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {active && isPlaying && hasAnyVoice && s.voiceoverUrl ? (
                      <SpeakingIcon className="h-4 w-4" />
                    ) : (
                      <MicIcon className="h-4 w-4" />
                    )}
                  </span>

                  {/* Track body */}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-foreground">
                        Scene {s.index ?? idx + 1}
                        <span className="ml-2 hidden font-normal text-muted-foreground sm:inline">
                          {(s.caption && s.caption.trim() && s.caption !== "Scene" ? s.caption : (s.voiceoverLine ?? s.description) ?? "").slice(0, 48)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {hasAnyVoice && s.voiceoverUrl ? "voiceover" : "no audio"} ·{" "}
                        {inTotal ? `${fmt(inTotal)}` : "—"}
                      </span>
                    </span>

                    {/* Actual narration line so users can see each track's
                        own script (and verify audio matches what they hear). */}
                    {(s.voiceoverLine ?? s.description) && (
                      <span className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground/85 italic">
                        &ldquo;{s.voiceoverLine ?? s.description}&rdquo;
                      </span>
                    )}

                    {/* Mini waveform with active fill — when this scene is currently
                        playing, the bars pulse to show "audio is live". */}
                    <span className="relative flex h-5 items-center gap-[1px]">
                      {wave.map((v, bi) => {
                        const progressRatio = active
                    ? playheadWithinScene(
                        s,
                        playhead,
                        playback.voiceoverCurrentTime,
                        playback.voiceoverDuration,
                        playback.isPlaying && !!s.voiceoverUrl
                      )
                    : 0;
                        const filled = active && bi / wave.length <= progressRatio;
                        const speaking = active && isPlaying && hasAnyVoice && !!s.voiceoverUrl;
                        return (
                          <span
                            key={bi}
                            className={clsx(
                              "h-full flex-1 rounded-[1px]",
                              speaking && bi % 4 === 0 && "voice-pulse"
                            )}
                            style={{
                              height: `${v * 100}%`,
                              background: filled
                                ? "var(--primary)"
                                : active
                                  ? "var(--primary)"
                                  : "var(--border)",
                              opacity: active ? 1 : 0.85,
                            }}
                          />
                        );
                      })}
                    </span>
                  </span>

                  {/* Per-track VU + provider + download */}
                  <span className="flex shrink-0 items-center gap-2">
                    <TrackMeter active={active} level={active && isPlaying ? 0.6 : 0} />
                    <span className="flex flex-col items-end gap-1">
                      {s.voiceoverUrl && (
                        <a
                          href={s.voiceoverUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open the MP3 in a new tab"
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 text-[10px] font-semibold text-primary opacity-0 transition-opacity hover:bg-primary/20 group-hover:opacity-100"
                        >
                          <DownloadIcon className="h-3 w-3" />
                          mp3
                        </a>
                      )}
                      {s.voiceProvider && s.voiceProvider !== "demo" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {s.voiceProvider}
                          {typeof s.voiceCostUsd === "number" && s.voiceCostUsd > 0
                            ? ` · $${s.voiceCostUsd.toFixed(3)}`
                            : ""}
                        </span>
                      )}
                      {/* Live timestamp: "now speaking 0:04 / 0:11" — only
                          shown on the row whose voiceover is currently
                          playing, so the user can see the sync visually. */}
                      {active && playback.isPlaying && playback.voiceoverDuration > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-primary">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          {formatVoiceoverTime(playback.voiceoverCurrentTime)} / {formatVoiceoverTime(playback.voiceoverDuration)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact stereo-style VU meter for the master strip. */
function MasterMeter({ active, level }: { active: boolean; level: number }) {
  return (
    <div className="flex items-center gap-1 rounded bg-background px-1.5 py-1 ring-1 ring-border">
      <span className="text-[8px] font-bold text-muted-foreground/70">L</span>
      <MeterSegmentBar active={active} level={level} segments={10} />
      <span className="text-[8px] font-bold text-muted-foreground/70">R</span>
      <MeterSegmentBar active={active} level={level * 0.95} segments={10} />
    </div>
  );
}

function MeterSegmentBar({
  active,
  level,
  segments,
}: {
  active: boolean;
  level: number;
  segments: number;
}) {
  return (
    <div className="flex h-3 items-end gap-[1px]">
      {Array.from({ length: segments }).map((_, i) => {
        const seg = i / segments;
        const isOn = active && seg <= level;
        const color =
          seg > 0.85
            ? "bg-red-500"
            : seg > 0.7
              ? "bg-amber-400"
              : "bg-emerald-400";
        return (
          <span
            key={i}
            className={clsx("w-[2px] rounded-[0.5px]", isOn ? color : "bg-foreground/15")}
            style={{ height: `${60 + i * 4}%` }}
          />
        );
      })}
    </div>
  );
}

/** Tiny vertical meter for an individual track. */
function TrackMeter({ active, level }: { active: boolean; level: number }) {
  return (
    <div className="hidden h-7 w-2 flex-col-reverse gap-[1px] overflow-hidden rounded-sm bg-foreground/10 sm:flex">
      {Array.from({ length: 8 }).map((_, i) => {
        const seg = i / 8;
        const isOn = active && seg <= level;
        const color =
          seg > 0.85
            ? "bg-red-500"
            : seg > 0.7
              ? "bg-amber-400"
              : "bg-emerald-400";
        return (
          <span
            key={i}
            className={clsx("w-full", isOn ? color : "bg-transparent")}
            style={{ height: "12.5%" }}
          />
        );
      })}
    </div>
  );
}

function playheadWithinScene(
  scene: any,
  playhead: number,
  voiceoverT: number,
  voiceoverD: number,
  voiceoverActive: boolean
): number {
  if (voiceoverActive && voiceoverD > 0) {
    // Use the actual voiceover currentTime as the source of truth for
    // the active scene — guarantees the row's progress bar is in
    // perfect lockstep with what's audible.
    return Math.min(1, voiceoverT / voiceoverD);
  }
  const dur = scene.durationSeconds ?? 0;
  if (!dur) return 0;
  const local = playhead % dur;
  return Math.min(1, local / dur);
}

function formatVoiceoverTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/* --------------------------------- icons -------------------------------- */

function TransportButton({
  children,
  label,
  onClick,
  disabled,
  tone,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-35",
        tone === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
function SkipBackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 6h2v12H6zM18 6l-8 6 8 6V6z" />
    </svg>
  );
}
function SkipForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M16 6h2v12h-2zM6 6l8 6-8 6V6z" />
    </svg>
  );
}
function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}
function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
      <path d="M12 17v4" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
function WaveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden>
      <path d="M3 12h.5M7 6v12M11 3v18M15 8v8M19 6v12M21 12h-.5" />
    </svg>
  );
}
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function SpeakingIcon({ className }: { className?: string }) {
  // Mic with sound waves — appears next to the row that's currently
  // speaking, so the user can see which voiceover is playing.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <path d="M3 6l1.5 1.5M21 6l-1.5 1.5M3 18l1.5-1.5M21 18l-1.5-1.5" />
    </svg>
  );
}
