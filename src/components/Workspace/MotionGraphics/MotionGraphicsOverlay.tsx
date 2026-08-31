"use client";

import { useEffect, useMemo, useState } from "react";
import type { Scene } from "@/types";
import {
  pickMotionDesign,
  pickTransitionForBeat,
  patternClass,
  colorGradeClass,
  type MotionDesign,
} from "./patterns";
import { LowerThird, SceneTitle, Callout, Watermark } from "./KineticText";
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
 *   6. Scene title (top eyebrow)
 *   7. Lower third (bottom bar with eyebrow + title)
 *   8. Kinetic caption (BIG TEXT, per-word stagger)
 *   9. Callout (small pop-up note)
 *  10. Watermark (top-right brand mark)
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

  // Brand mark for watermark — project name trimmed to 14 chars.
  const watermark = (brand ?? "Creative Studio").slice(0, 14).toUpperCase();

  // Lower-third copy — use beat name as eyebrow, scene description's
  // first sentence as title. Falls back to voiceoverLine so the
  // overlay always has something readable.
  const ltEyebrow = (beatName ?? scene.beatName ?? "Scene").toUpperCase();
  const ltTitle = firstSentence(
    voiceoverLine ?? scene.voiceoverLine ?? scene.description ?? ""
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
          scene.videoUrl !== "__no_video__" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <video
              key={`${scene.id}-video`}
              src={scene.videoUrl}
              poster={scene.imageUrl ?? undefined}
              className="h-full w-full object-cover"
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
              className="h-full w-full object-cover"
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

        {/* 6. Scene title — small eyebrow at top. */}
        {design.overlays.includes("scene-title-eyebrow") && (
          <SceneTitle
            index={scene.index}
            label={(beatName ?? scene.beatName ?? `Scene ${scene.index}`).toUpperCase()}
            accent={design.accent}
          />
        )}

        {/* 7. Lower third — branded bar with eyebrow + title. */}
        {design.overlays.includes("lower-third") && (
          <LowerThird
            eyebrow={ltEyebrow}
            title={ltTitle}
            subtitle={scene.caption}
            accent={design.accent}
          />
        )}

        {/* 8. Kinetic caption — BIG TEXT, per-word stagger.
            Removed per product direction: the narration script text no
            longer overlays the footage so the scene video/image plays
            clean without the words stealing focus. (KineticCaption is
            still imported/available if we ever want it back.) */}


        {/* 9. Callout — pop-up label for key message. */}
        {design.overlays.includes("callout") && (
          <Callout
            text={scene.caption ?? "Key insight"}
            position={{ top: "30%", right: "6%" }}
            accent={design.accent}
          />
        )}

        {/* 10. Watermark — top-right brand mark. */}
        {design.overlays.includes("watermark") && <Watermark text={watermark} />}
      </div>
    </TransitionEffect>
  );
}

function firstSentence(s: string): string {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return "";
  const dot = trimmed.indexOf(".");
  if (dot > 0 && dot < 60) return trimmed.slice(0, dot);
  return trimmed.slice(0, 60);
}
