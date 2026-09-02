"use client";

import { useMemo } from "react";
import type { Scene } from "@/types";
import {
  pickMotionDesign,
  pickTransitionForBeat,
  patternClass,
  colorGradeClass,
} from "./patterns";
// Text overlay imports removed — see comment in JSX about clean preview.
import { Particles } from "./Particles";
import { TransitionEffect } from "./TransitionEffect";
import "./MotionGraphics.css";

interface MotionGraphicsOverlayProps {
  scene: Scene;
  /** Total project duration in seconds (used as fallback when scene
   *  durationSeconds is missing). */
  totalDurationSeconds: number;
  /** Voiceover line for the kinetic caption. If empty, the caption
   *  overlay is skipped (so the studio doesn't show stale text). */
  voiceoverLine?: string;
  /** Brand watermark (project name). Falls back to "Creative Studio". */
  brand?: string;
  /** Beat name (Hook / Setup / Context / Pain / Promise / Proof /
   *  Objection / Zoom) — drives the lower-third eyebrow label and
   *  the transition into this scene. */
  beatName?: string;
  /** When false, suppress all overlays (used for the "clean" view
   *  in inspector / debug). Default true. */
  enabled?: boolean;
}

/**
 * MotionGraphicsOverlay — the single component that turns a still
 * image (or video clip) into a fully designed motion-graphics scene.
 *
 * Layer order, bottom to top:
 *   1. Scene image / video (Ken Burns, parallax, etc. driven by
 *      MotionDesign.pattern via CSS class mg-pat-*)
 *   2. Color grade (mg-grade-*)
 *   3. Vignette (radial dark overlay, optional)
 *   4. Light leak (warm sweep, optional)
 *   5. Particles (warm/cool/mixed, optional)
 *
 * Text overlays (LowerThird, SceneTitle, Callout, Watermark,
 * KineticCaption) are intentionally excluded so the preview
 * shows a clean visual without script text on screen.
 *
 * The wrapper element gets `key={scene.id}` so React remounts on
 * every scene change — this is what triggers CSS animations to
 * replay (keyframe `forwards` ends at 100%, remount resets to 0%).
 *
 * The component is purely presentational — no state, no effects on
 * the world. The parent (VideoPreview) decides which scene is active
 * and passes it in; this overlay only renders that one scene's
 * motion design.
 */
export function MotionGraphicsOverlay({
  scene,
  totalDurationSeconds,
  voiceoverLine,
  brand,
  beatName,
  enabled = true,
}: MotionGraphicsOverlayProps) {
  // If overlays are off, render a no-op wrapper so the parent can
  // still key on `scene.id` without paying the render cost.
  const design = useMemo(() => pickMotionDesign(scene), [scene]);
  const transition = useMemo(
    () => pickTransitionForBeat(beatName ?? scene.beatName ?? undefined),
    [beatName, scene.beatName],
  );
  const duration = Math.max(
    2,
    Math.min(20, scene.durationSeconds ?? totalDurationSeconds ?? 8)
  );

  if (!enabled) return null;

  return (
    <TransitionEffect type={transition}>
      <div
        key={scene.id}
        className="mg-scene-canvas pointer-events-none absolute inset-0"
        style={{ "--mg-duration": `${duration}s` } as React.CSSProperties}
        aria-hidden
      >
        {/* 1. Scene image — receives Ken Burns / parallax via
            pattern class. Children at z-0 so overlays stack above. */}
        <div
          className={`mg-scene-canvas ${patternClass(design.pattern)} ${colorGradeClass(design.colorGrade)}`}
          style={
            {
              "--mg-duration": `${duration}s`,
              "--mg-accent": design.accent,
            } as React.CSSProperties
          }
        >
          {scene.videoUrl &&
          !scene.videoUrl.endsWith(".png") &&
          !scene.videoUrl.endsWith(".jpg") &&
          !scene.videoUrl.startsWith("data:image/") &&
          scene.videoUrl !== "__no_video__" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <video
              key={`${scene.id}-video`}
              src={scene.videoUrl}
              poster={scene.imageUrl ?? undefined}
              className="h-full w-full object-contain"
              autoPlay
              muted
              loop
              playsInline
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : scene.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${scene.id}-img`}
              src={scene.imageUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>

        {/* 3. Vignette — sits over the canvas. */}
        {design.overlays.includes("vignette") && <div className="mg-vignette" />}

        {/* 4. Light leak — diagonal warm sweep. */}
        {design.overlays.includes("light-leak") && <div className="mg-light-leak" />}

        {/* 5. Particles — drifting motes. */}
        {design.particles !== "none" && design.particleCount > 0 && (
          <Particles count={design.particleCount} style={design.particles} />
        )}

        {/* Text overlays (LowerThird, SceneTitle, Callout, Watermark)
            removed — the preview shows only the scene image/video
            with motion effects (Ken Burns, color grade, particles)
            so the visual plays clean without script text overlays. */}
      </div>
    </TransitionEffect>
  );
}


