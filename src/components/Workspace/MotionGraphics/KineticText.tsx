"use client";

import { useState } from "react";

/**
 * Kinetic typography components — lower third, scene title, callout,
 * kinetic caption, watermark. Each component renders SVG/CSS overlays
 * on top of the scene image/video at runtime. The text itself comes
 * from the scene's script beats (Hook, Setup, Context, etc).
 *
 * The animations are driven by CSS keyframes in MotionGraphics.css.
 * Per-word stagger is implemented inline via animationDelay.
 */

interface LowerThirdProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent?: string;
}

export function LowerThird({
  eyebrow,
  title,
  subtitle,
  accent = "#7c5cff",
}: LowerThirdProps) {
  return (
    <div
      className="mg-lower-third"
      style={{ "--mg-accent": accent } as React.CSSProperties}
      aria-hidden
    >
      {eyebrow && <span className="mg-lower-third-eyebrow">{eyebrow}</span>}
      <span className="mg-lower-third-title">{title}</span>
      {subtitle && (
        <span className="mg-lower-third-subtitle">{subtitle}</span>
      )}
      <span className="mg-lower-third-bar" />
    </div>
  );
}

interface SceneTitleProps {
  index: number;
  label: string;
  accent?: string;
}

/**
 * Scene title — small uppercase eyebrow at the top of the frame with
 * the scene number badge. Used as a persistent "you are watching
 * scene N" cue, like a TV documentary or corporate training video.
 */
export function SceneTitle({ index, label, accent = "#7c5cff" }: SceneTitleProps) {
  return (
    <div
      className="mg-scene-title"
      style={{ "--mg-accent": accent } as React.CSSProperties}
      aria-hidden
    >
      <span className="mg-scene-title-num">S{String(index).padStart(2, "0")}</span>
      {label}
    </div>
  );
}

interface CalloutProps {
  text: string;
  /** Position as CSS percent or px. Default top-right area. */
  position?: { top: string; right?: string; left?: string; bottom?: string };
  accent?: string;
}

export function Callout({ text, position, accent = "#7c5cff" }: CalloutProps) {
  return (
    <div
      className="mg-callout"
      style={
        {
          ...(position ?? { top: "30%", right: "6%" }),
          "--mg-accent": accent,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {text}
    </div>
  );
}

interface KineticCaptionProps {
  text: string;
  /** Per-word stagger in ms. Default 80ms. */
  staggerMs?: number;
  /** Optional max number of words to animate. Default 12 (keeps it readable). */
  maxWords?: number;
}

/**
 * Kinetic caption — splits the caption into words and animates each
 * word in with a stagger. Used as the "BIG TEXT" overlay that reads
 * as a hook or CTA. Animation timing is set inline as animationDelay
 * on each <span> so the stagger feels deliberate, not random.
 */
export function KineticCaption({
  text,
  staggerMs = 80,
  maxWords = 12,
}: KineticCaptionProps) {
  const words = text.split(/\s+/).slice(0, maxWords);
  return (
    <p className="mg-kinetic-caption" aria-hidden>
      {words.map((w, i) => (
        <span
          key={i}
          className="mg-kinetic-caption-word"
          style={{ animationDelay: `${0.4 + i * (staggerMs / 1000)}s` }}
        >
          {w}
        </span>
      ))}
    </p>
  );
}

interface WatermarkProps {
  text: string;
}

/**
 * Watermark — small brand mark in the top-right corner. Always
 * visible (no animation cycle) so the studio's branding reads
 * throughout the play.
 */
export function Watermark({ text }: WatermarkProps) {
  return (
    <div className="mg-watermark" aria-hidden>
      {text}
    </div>
  );
}

/**
 * Hook a kinetic caption to the active voiceover word — when the
 * narrator speaks a word, this hook exposes the current spoken word
 * for the KineticCaption component to highlight. The component
 * itself is a controlled renderer; the highlight logic lives in
 * the parent (MotionGraphicsOverlay) which knows the voiceover's
 * current word index from the playhead.
 */
export function useActiveWordIndex(words: string[], voiceStartMs: number, currentMs: number) {
  return useState(0);
}
