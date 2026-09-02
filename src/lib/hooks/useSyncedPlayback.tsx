"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import type { Scene } from "@/types";

/**
 * Single, shared playback engine. ONE hidden <audio> element plays the
 * per-scene voiceover (narration), and the voiceover IS the master clock
 * for the timeline. There is intentionally NO background music — the
 * scene scripts (voiceover narrations) are the focus.
 *
 *   audio.currentTime  ─►  store.playheadSeconds
 *                          ├─► video.currentTime (Program Monitor)
 *                          ├─► image crossfade (Program Monitor)
 *                          ├─► timeline strip playhead
 *                          └─► Audio Mixer scene-row fill
 *
 * Single clock → cannot drift. When the voiceover for Scene N finishes,
 * onEnded jumps the playhead to Scene N+1's audio start and the new
 * voiceover element (keyed by sceneId) mounts and starts at 0.
 *
 * If a scene has no voiceoverUrl (silent scene), the rAF falls back to
 * real-time dt advance and the scene gets the full scene duration on
 * screen with no audio — better than getting skipped.
 *
 * --- Pass 37: real audio time as the master clock ---
 *
 * Earlier versions computed playhead = currentSceneStart + audio.currentTime
 * where `currentSceneStart` came from summing each scene's `durationSeconds`.
 * That was broken whenever the actual voiceover was longer than the slot
 * (which is the common case — script defaults the slot to 4s, but a real
 * narration mp3 is often 4.5–5.5s). When audio.currentTime crossed the slot
 * boundary, the rAF tick wrote playhead into the next scene's range and
 * React remounted the audio element with a new `key`, cutting the
 * narration off mid-word. That's the "audio repeats / not in sync / some
 * are missing" the user was reporting.
 *
 * The fix is to make the playhead reflect the REAL cumulative audio time
 * (sum of `voiceoverDurationMs ?? durationSeconds * 1000`), not the
 * slot-based time. The slot stays as the timeline's UI anchor but no
 * longer drives playback timing. The audio element is keyed by
 * `scene.id` (not slot boundary) and is only remounted when the audio's
 * natural `ended` event fires — never because of a playhead write.
 *
 * Hydration safety net: on every scene list change, we backfill any
 * missing `durationSeconds` from the voiceover's actual length so legacy
 * state files (or HTTP-route paths that didn't capture durationMs)
 * still play correctly on the first frame.
 */
export type SyncedPlayback = {
  audioElement: React.ReactNode;
  isPlaying: boolean;
  playhead: number;
  setPlayhead: (seconds: number) => void;
  setIsPlaying: (playing: boolean) => void;
  currentScene: Scene | null;
  currentSceneStart: number;
  totalDuration: number;
  progressInScene: number;
  totalProgress: number;
  playFromClick: (scene?: Scene) => void;
  nextScene: () => void;
  voiceoverCurrentTime: number; // 0..voiceover.duration — UI uses this for "now speaking" indicator
  voiceoverDuration: number;    // voiceover.duration — total clip length for currently playing row
  /**
   * When true, the standalone <audio> narration element is muted — the host
   * (e.g. a composed <video> mp4) carries its own muxed audio and the extra
   * live-clip playback would create a doubled, slightly-offset voiceover
   * that reads as "audio not in sync with video". UI consumers that own the
   * audio (the composed MP4 path) set this true.
   */
  narrationMuted: boolean;
};

export function useSyncedPlayback(options?: { narrationMuted?: boolean }): SyncedPlayback {
  const scenes = useStudioStore((s) => s.project.scenes);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const playhead = useStudioStore((s) => s.playheadSeconds);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track the previous scene id so we can detect scene transitions
  // triggered by an external source (e.g. clicking a scene button) and
  // seek the playhead to that scene's start.
  const lastSceneIdRef = useRef<string | null>(null);
  // Live values from the audio element, exposed to UI for the
  // "now speaking" indicator on the active row.
  const [voiceoverTime, setVoiceoverTime] = useState({ t: 0, d: 0 });
  // Real, measured audio duration per scene id, populated from each
  // <audio>'s loadedmetadata/durationchange. This is the single source of
  // truth for the master clock — it beats the stale `voiceoverDurationMs`
  // in state, which is only a snapshot from the HTTP route and can (and
  // does) drift from the actual mp3 length. `realTick` is a render bump so
  // the dependent memos recompute when a duration lands.
  const realDurationsRef = useRef<Map<string, number>>(new Map());
  const [realTick, setRealTick] = useState(0);

  /**
   * The authoritative per-scene "audio duration" used for the master
   * clock. We prefer `voiceoverDurationMs` because that's the actual
   * length of the rendered mp3; fall back to `durationSeconds * 1000`
   * for scenes that haven't been voiced yet (silent placeholder scenes
   * that advance via real-time dt in the rAF tick). Floor of 0.05s
   * ensures the "no audio, advance by real time" branch doesn't get a
   * zero-duration scene stuck forever.
   */
  const audioDurations = useMemo(() => {
    return scenes.map((s) => {
      // Prefer the REAL measured audio duration (from the loaded <audio>)
      // over the metadata snapshot. `voiceoverDurationMs` / `durationSeconds`
      // in state can drift from the actual file (e.g. a re-rendered mp3 that's
      // longer than the script default) — trusting it was what cut scenes off
      // mid-word. Only fall back to metadata before the clip has loaded.
      const real = realDurationsRef.current.get(s.id);
      if (typeof real === "number" && real > 0) return real;
      if (typeof s.voiceoverDurationMs === "number" && s.voiceoverDurationMs > 0) {
        return s.voiceoverDurationMs / 1000;
      }
      return Math.max(0.05, s.durationSeconds ?? 0);
    });
  }, [scenes, realTick]);

  /**
   * Cumulative start time of each scene's audio in REAL audio seconds
   * (not slot seconds). This is the master clock — `playhead` always
   * lives in this space so audio and visuals cannot drift, and an
   * audio element is only remounted when its natural `ended` event
   * fires (never because the rAF tick crossed a slot boundary).
   */
  const audioStartTimes = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      starts.push(acc);
      acc += audioDurations[i];
    }
    return starts;
  }, [scenes, audioDurations]);

  /**
   * Total playback length in real audio seconds. Used to size the
   * timeline strip and to clamp the playhead when reaching the end.
   */
  const totalDuration = useMemo(() => {
    return audioStartTimes.length
      ? audioStartTimes[audioStartTimes.length - 1] +
          audioDurations[audioDurations.length - 1]
      : 0;
  }, [audioStartTimes, audioDurations]);

  /**
   * Hydration safety net (Pass 37): if a scene has a voiceoverUrl but
   * `durationSeconds` is still the script default (or is shorter than
   * the actual audio), bump it to match the audio on the next render
   * so the timeline UI stays in sync with the master clock. We mutate
   * via the store's updateScene action — never inline — so the change
   * is persisted and any other hook that reads `durationSeconds` (the
   * timeline ruler, storyboard tiles, export manifest) sees the same
   * value the playback engine is using.
   */
  useEffect(() => {
    const updates: Array<{ id: string; patch: Partial<Scene> }> = [];
    for (const s of scenes) {
      if (typeof s.voiceoverDurationMs !== "number") continue;
      const audioSec = s.voiceoverDurationMs / 1000;
      const slotSec = s.durationSeconds ?? 0;
      // Target slot is the smallest whole number of seconds that covers
      // the real narration (ceil), floored at 1s. We compare against the
      // TARGET (not the raw audio seconds): once slotSec equals it, the
      // check is false and no further update fires. Comparing against raw
      // audioSec with a tolerance was a bug — slot is ceil(audio), so
      // |slot - audio| is never < 0.05 unless audio is an exact integer,
      // which meant updateScene kept firing forever (each updateScene
      // maps a new scenes array → this effect re-runs → infinite loop
      // that pegged the main thread and froze the browser).
      const target = Math.max(1, Math.ceil(audioSec));
      if (slotSec !== target) {
        updates.push({ id: s.id, patch: { durationSeconds: target } });
      }
    }
    if (updates.length > 0) {
      // Defer to next tick so we don't update state during render.
      queueMicrotask(() => {
        const store = useStudioStore.getState();
        for (const u of updates) store.updateScene(u.id, u.patch);
      });
    }
  }, [scenes]);

  // Current scene under the playhead + its audio start time.
  // Pass 37: looks up by audio start time, not slot start time, so the
  // scene "under" the playhead is whichever scene's audio is currently
  // playing — regardless of slot arithmetic.
  const { currentScene, currentSceneStart } = useMemo(() => {
    if (scenes.length === 0) {
      return { currentScene: null, currentSceneStart: 0 };
    }
    for (let i = 0; i < scenes.length; i++) {
      const start = audioStartTimes[i];
      const dur = audioDurations[i];
      if (playhead >= start && playhead < start + dur) {
        return { currentScene: scenes[i], currentSceneStart: start };
      }
    }
    // Past the end — show the last scene (and stop advancing).
    if (playhead >= totalDuration) {
      const last = scenes.length - 1;
      return {
        currentScene: scenes[last],
        currentSceneStart: audioStartTimes[last],
      };
    }
    // Before the start — show the first scene.
    return {
      currentScene: scenes[0],
      currentSceneStart: audioStartTimes[0] ?? 0,
    };
  }, [scenes, playhead, audioStartTimes, audioDurations, totalDuration]);

  // Scene id under the playhead. The voiceover <audio> is keyed by this
  // so React unmounts the old element and mounts a fresh one each scene
  // change — the cleanest way to guarantee a fresh, willing-to-play
  // <audio> per scene across all browsers.
  const currentSceneId = currentScene?.id ?? null;

  // Track the scene id of the currently-mounted voiceover element so we
  // can distinguish "fresh mount after a scene change" (which should
  // restart the clip from 0) from "same scene, just play/pause toggle"
  // (which should resume from the natural position).
  const mountedSceneIdRef = useRef<string | null>(null);

  // Master clock: rAF reads voiceover.currentTime (when present) and
  // pushes that into store.playheadSeconds, so the video/image/timeline
  // follow the audio EXACTLY. When no voiceover is loaded for the
  // current scene, fall back to real-time dt advance so the scene still
  // gets its full duration on screen.
  //
  // Pass 37: cap the playhead write at the current scene's audio end
  // so a voiceover that's longer than its slot can't push the playhead
  // into the next scene's range and trigger a remount mid-clip.
  //
  // When the host carries its own audio (e.g. the composed MP4) the
  // standalone <audio> is muted — its currentTime would fight the host's
  // onTimeUpdate for the playhead, causing micro-stutter on every frame.
  // In that mode, the host owns the clock and we skip the rAF entirely.
  useEffect(() => {
    if (!isPlaying) return;
    if (options?.narrationMuted) return; // host owns the clock
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const a = audioRef.current;
      const hasVoice =
        a && a.src && isFinite(a.duration) && (a.duration ?? 0) > 0;
      if (hasVoice) {
        // Critical: if the audio has just ended (or the element is past
        // its duration), DO NOT write playhead back from the old
        // currentSceneStart closure. The `ended` event is already firing
        // handleVoiceoverEnded which will set the correct playhead for
        // the next scene. Writing the OLD closure's expected value here
        // pulls the playhead BACK into the previous scene's range,
        // causing React to remount the just-finished audio element and
        // replay it from 0.
        if (a.ended || (a.duration > 0 && (a.currentTime ?? 0) >= a.duration - 0.05)) {
          // Skip — handleVoiceoverEnded owns the transition.
          setVoiceoverTime({ t: a.duration, d: a.duration });
          raf = requestAnimationFrame(tick);
          return;
        }
        const start = currentSceneStart;
        const audioEnd = a.duration;
        // Cap at the scene's audio end. If the rAF would advance past
        // audioEnd, hold playhead at audioEnd so the timeline ruler
        // stops advancing — but the audio itself keeps playing until
        // its natural ended event fires handleVoiceoverEnded.
        const expected = Math.min(start + (a.currentTime ?? 0), start + audioEnd);
        const current = useStudioStore.getState().playheadSeconds;
        if (Math.abs(current - expected) > 0.02) {
          setPlayhead(expected);
        }
        // Push live voiceover progress to React so the UI can show
        // "0:04 / 0:11" + a per-row progress bar on the active row.
        setVoiceoverTime({
          t: a.currentTime ?? 0,
          d: a.duration ?? 0,
        });
      } else {
        // No voiceover loaded — keep advancing by real time so the
        // visual scene still gets its full duration on screen. Use the
        // audio-time clock so the cap is consistent with the voiced
        // path.
        const next = useStudioStore.getState().playheadSeconds + dt;
        const cap = currentSceneStart + (audioDurations[currentScene ? scenes.indexOf(currentScene) : 0] ?? 0);
        const finalNext = Math.min(next, cap);
        if (totalDuration > 0 && finalNext >= totalDuration) {
          // End of project: stop and park on the last scene (no wrap to 0).
          setIsPlaying(false);
          setVoiceoverTime({ t: 0, d: 0 });
          return;
        }
        setPlayhead(finalNext);
        setVoiceoverTime({ t: 0, d: 0 });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentSceneStart, setPlayhead, setIsPlaying, totalDuration, currentScene, scenes, audioDurations, options?.narrationMuted]);

  // When the voiceover clip finishes naturally, advance to the next
  // scene so the next narration plays back-to-back. This makes the
  // voiceover the master clock for the script, in sync with the
  // video/image shown in the Program Monitor.
  //
  // Pass 37: jump to the next scene's audio start (in real audio
  // seconds), not the slot-based start. This is what keeps the chain
  // tight when a voiceover is longer than its slot.
  //
  // When narration is muted (host owns the audio, e.g. composed MP4),
  // ignore this — the host's own `ended` handler stops playback and the
  // scene-by-scene advance would race the host's clock.
  const handleVoiceoverEnded = useCallback(() => {
    if (options?.narrationMuted) return;
    const state = useStudioStore.getState();
    const idx = state.project.scenes.findIndex((s) => s.id === currentSceneId);
    if (idx < 0) return;
    const next = state.project.scenes[idx + 1];
    if (!next) {
      // End of project — stop the engine and park on the last scene (the
      // playhead is already at the true end). We deliberately do NOT reset
      // to 0 here: snapping back to scene 1 made the deck look like it was
      // replaying from the top. The Audio Mixer / editor can reset via the
      // skip-to-start control when the user wants to start over.
      setIsPlaying(false);
      setVoiceoverTime({ t: 0, d: 0 });
      return;
    }
    setPlayhead(audioStartTimes[idx + 1]);
    setVoiceoverTime({ t: 0, d: 0 });
  }, [currentSceneId, audioStartTimes, setIsPlaying, setPlayhead, options?.narrationMuted]);

  // Callback ref attached to the voiceover <audio>. Runs SYNCHRONOUSLY
  // during render commit so the play() call inherits the sticky
  // user-gesture activation from the click that flipped isPlaying to true.
  //
  // Pass 37: when `currentSceneId` changes, we set `mountedSceneIdRef`
  // so the next mount can detect "this is a new scene's element" and
  // restart from 0. We deliberately do NOT depend on `currentScene`
  // here — only on `currentSceneId` — so React's identity check on the
  // `<audio key>` is the single source of truth for "fresh mount".
  const audioCallbackRef = useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (!el) return;
      // When the host (e.g. composed MP4) is providing its own muxed audio,
      // mute this standalone clip so the user doesn't hear the narration
      // twice — the doubled playback was the source of "video not in sync
      // with audio" reports. The clip is still loaded (so onEnded /
      // currentTime stay accurate for timeline navigation), just inaudible.
      el.muted = !!options?.narrationMuted;
      el.volume = 1;
      const freshMount = mountedSceneIdRef.current !== currentSceneId;
      if (freshMount) {
        // Brand new element (because key=sceneId just changed) → start
        // the clip from 0 so the spoken narration begins at the start
        // of the scene.
        try {
          el.currentTime = 0;
        } catch {
          /* before metadata */
        }
        mountedSceneIdRef.current = currentSceneId;
        setVoiceoverTime({ t: 0, d: 0 });
      }
      if (isPlaying && currentScene?.voiceoverUrl) {
        void el.play().catch(() => {});
      } else {
        el.pause();
      }
    },
    [isPlaying, currentScene, currentSceneId],
  );

  // Programmatic next-scene step (called by handleVoiceoverEnded OR by
  // the Audio Mixer's Next button).
  const nextScene = useCallback(() => {
    const state = useStudioStore.getState();
    const idx = state.project.scenes.findIndex((s) => s.id === currentSceneId);
    if (idx < 0) return;
    const next = state.project.scenes[idx + 1];
    if (!next) {
      // Already on the last scene — just stop (stay parked here, no wrap).
      setIsPlaying(false);
      return;
    }
    setPlayhead(audioStartTimes[idx + 1] ?? 0);
  }, [currentSceneId, audioStartTimes, setIsPlaying, setPlayhead]);

  // When the user clicks a scene button (or anything else that changes
  // the current scene id WITHOUT changing the playhead), snap the
  // playhead to that scene's audio start so the voiceover audio element
  // remounts cleanly and starts from its own narration's beginning.
  useEffect(() => {
    if (!currentSceneId) return;
    if (lastSceneIdRef.current === currentSceneId) return;
    const prev = lastSceneIdRef.current;
    lastSceneIdRef.current = currentSceneId;
    if (prev == null) return; // initial mount — leave playhead where it is
    setPlayhead(currentSceneStart);
  }, [currentSceneId, currentSceneStart, setPlayhead]);

  // While the user is scrubbing (or paused), keep the audio element's
  // currentTime in lock-step with the playhead so the next play()
  // resumes from the exact frame they're looking at — without this,
  // scrubbing within a scene leaves audio at 0 and on resume the rAF
  // tick would yank the playhead back to the audio's actual position.
  //
  // Pass 37: clamp the seek target to the current scene's audio end so
  // a scrub past the slot boundary doesn't park audio in the next
  // scene's clip.
  useEffect(() => {
    if (isPlaying) return; // rAF owns sync while playing
    const a = audioRef.current;
    if (!a || !currentScene || !currentScene.voiceoverUrl) return;
    const dur = a.duration || audioDurations[scenes.indexOf(currentScene)] || 0;
    const target = Math.max(0, Math.min(dur, playhead - currentSceneStart));
    if (Math.abs(a.currentTime - target) > 0.05) {
      try {
        a.currentTime = target;
      } catch {
        /* before metadata */
      }
      setVoiceoverTime({ t: target, d: dur });
    }
  }, [playhead, currentSceneStart, isPlaying, currentScene, audioDurations, scenes]);

  const progressInScene = currentScene
    ? audioDurations[scenes.indexOf(currentScene)]
      ? Math.min(1, (playhead - currentSceneStart) / audioDurations[scenes.indexOf(currentScene)])
      : 0
    : 0;
  const totalProgress = totalDuration
    ? Math.min(1, playhead / totalDuration)
    : 0;

  const audioElement = (
    <>
      {/* Voiceover — keyed by sceneId so it remounts on scene change.
          Pass 37: only ONE <audio> renders (the voiced one). We always
          render the voiced branch because currentScene is whichever
          scene is under the audio-time playhead — the master clock
          never advances past a scene that has no audio (the rAF dt
          path is the fallback). */}
      {currentScene?.voiceoverUrl ? (
        <audio
          key={`voice_${currentSceneId}`}
          ref={audioCallbackRef}
          src={currentScene.voiceoverUrl}
          preload="auto"
          playsInline
          className="hidden"
          onEnded={handleVoiceoverEnded}
          onLoadedMetadata={(e) => {
            // Record the REAL duration of this voiceover clip as the master
            // clock truth. `voiceoverDurationMs` in state is a stale snapshot
            // that drifts from the actual file; using the measured duration
            // stops scenes from being cut off mid-word and keeps the scene
            // boundary exactly at the real narration end.
            const d = e.currentTarget.duration;
            if (currentSceneId && isFinite(d) && d > 0) {
              const map = realDurationsRef.current;
              if (map.get(currentSceneId) !== d) {
                map.set(currentSceneId, d);
                setRealTick((t) => t + 1);
              }
            }
          }}
          onError={() => {
            // Provider errored on this clip — advance the master clock
            // by the scene's audio slot so the next scene can take over.
            // Without this, a broken mp3 would freeze playback.
            const state = useStudioStore.getState();
            const idx = state.project.scenes.findIndex((s) => s.id === currentSceneId);
            if (idx >= 0 && state.project.scenes[idx + 1]) {
              setPlayhead(audioStartTimes[idx + 1] ?? 0);
            }
          }}
        />
      ) : null}
    </>
  );

  /**
   * Start (or resume) audible playback. MUST be called from a user-gesture
   * click handler so the browser's autoplay policy lets the audio actually
   * play in a real browser — calling `.play()` here synchronously (rather
   * than from a deferred effect) is what makes the sound audible.
   */
  function playFromClick(scene?: Scene) {
    const a = audioRef.current;
    if (a && a.src) void a.play().catch(() => {});
    void scene; // scene param preserved for API compatibility
  }

  return {
    audioElement,
    isPlaying,
    playhead,
    setPlayhead,
    setIsPlaying,
    currentScene,
    currentSceneStart,
    totalDuration,
    progressInScene,
    totalProgress,
    playFromClick,
    nextScene,
    voiceoverCurrentTime: voiceoverTime.t,
    voiceoverDuration: voiceoverTime.d,
    narrationMuted: !!options?.narrationMuted,
  };
}
