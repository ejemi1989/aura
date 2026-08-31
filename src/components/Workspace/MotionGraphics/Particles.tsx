"use client";

import { useMemo } from "react";

interface ParticlesProps {
  count: number;
  style: "none" | "warm" | "cool" | "mixed";
  /** Spread factor — particles drift from their start position by this
   *  many pixels of x and y variance. Higher = more chaotic. */
  spread?: number;
}

/**
 * A small particle field that drifts upward across the scene. Each
 * particle picks a random position, drift vector, size, and animation
 * delay so the field reads as ambient motion rather than a synchronized
 * animation. Used as part of the MotionGraphicsOverlay to give still
 * images a cinematic sense of "alive".
 *
 * Implementation note: positions/durations are computed once via
 * useMemo with a deterministic seed based on `count`, so the field
 * doesn't re-randomize every render (which would cause jank during
 * playback).
 */
export function Particles({ count, style, spread = 80 }: ParticlesProps) {
  const particles = useMemo(() => {
    if (count <= 0 || style === "none") return [];
    const out: {
      left: string;
      top: string;
      size: number;
      driftX: number;
      driftY: number;
      duration: number;
      delay: number;
      className: string;
    }[] = [];
    let seed = count * 7919 + (style === "warm" ? 1 : style === "cool" ? 2 : 3);
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i++) {
      const variant =
        style === "mixed" ? (rnd() > 0.5 ? "warm" : "cool") : style;
      const className =
        variant === "warm"
          ? "mg-particle mg-particle--warm"
          : "mg-particle mg-particle--cool";
      out.push({
        left: `${Math.round(rnd() * 100)}%`,
        top: `${Math.round(70 + rnd() * 30)}%`,
        size: rnd() > 0.8 ? 8 : 4,
        driftX: (rnd() - 0.5) * spread * 2,
        driftY: -80 - rnd() * spread,
        duration: 3.5 + rnd() * 3,
        delay: rnd() * 4,
        className: rnd() > 0.7 ? `${className} mg-particle--large` : className,
      });
    }
    return out;
  }, [count, style, spread]);

  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className={p.className}
          style={
            {
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--mg-drift-x": `${p.driftX}px`,
              "--mg-drift-y": `${p.driftY}px`,
              "--mg-particle-duration": `${p.duration}s`,
              "--mg-particle-delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
