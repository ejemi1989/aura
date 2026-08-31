// Motion Graphics pattern library — names + assignments.
//
// Each pattern is a named bundle of: motion transform, color grade, particle
// style, transition, and text overlays. The Creative Director's beat type
// drives the default assignment, but the per-scene override on
// `scene.motionPattern` wins if set (e.g. via the inspector's "Motion"
// dropdown, or by the critic-qa revision path).
//
// The CSS classes these names map to live in MotionGraphics.css.

export const MOTION_PATTERNS = [
  "kenBurns-in",
  "kenBurns-out",
  "parallax-drift",
  "glide-up",
  "pulse-zoom",
  "orbit-rotate",
  "tilt-shift",
  "glitch-burst",
] as const;

export type MotionPattern = (typeof MOTION_PATTERNS)[number];

export const TRANSITION_TYPES = [
  "crossfade",
  "zoom-blur",
  "slide-left",
  "slide-up",
  "particle-burst",
  "glitch-rgb",
] as const;

export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const COLOR_GRADES = [
  "cinematic",
  "warm",
  "cool",
  "punch",
  "documentary",
] as const;

export type ColorGrade = (typeof COLOR_GRADES)[number];

export const PARTICLE_STYLES = [
  "none",
  "warm",
  "cool",
  "mixed",
] as const;

export type ParticleStyle = (typeof PARTICLE_STYLES)[number];

export const ACCENTS = [
  "#7c5cff", // electric violet (default)
  "#20e3b2", // mint
  "#ffb454", // amber
  "#5cc8ff", // sky
  "#ff8ad4", // pink
  "#ff5c7a", // coral red
  "#c58cff", // lavender
  "#20c997", // teal
] as const;

export interface MotionDesign {
  pattern: MotionPattern;
  colorGrade: ColorGrade;
  particles: ParticleStyle;
  particleCount: number;
  /** Which text overlays to show. Defaults to a sensible per-scene set. */
  overlays: ("scene-title-eyebrow" | "lower-third" | "callout" | "kinetic-caption" | "watermark" | "vignette" | "light-leak")[];
  accent: string;
}

/**
 * Default pattern library — index-based fallback when the script beats
 * are unknown or the human has not overridden the motion design. Each
 * entry is tuned to the typical emotional arc of a 5-8 scene script.
 *
 *   Hook     (1)  → ken-burns in     (pull viewer in, dramatic)
 *   Setup    (2)  → parallax-drift   (slow pan, contemplative)
 *   Context  (3)  → pulse-zoom       (breath, gentle)
 *   Pain     (4)  → glitch-burst     (jarring, edgy)
 *   Promise  (5)  → ken-burns-out    (reveal, zoom out)
 *   Proof    (6)  → glide-up         (cinematic, documentary)
 *   Objection(7)  → orbit-rotate     (3D tilt, perspective shift)
 *   Zoom     (8+) → ken-burns-in     (CTA focus, dramatic)
 *
 * This list is intentionally over-determined — if a script has 12
 * scenes, scenes 9-12 wrap back to the start (Hook/Pain/etc cycle)
 * which keeps the visual rhythm coherent across long edits.
 */
export const DEFAULT_MOTION_BY_INDEX: MotionDesign[] = [
  // 1 — Hook: dramatic zoom in, cool grade, watermark + lower-third
  {
    pattern: "kenBurns-in",
    colorGrade: "cool",
    particles: "cool",
    particleCount: 6,
    overlays: ["watermark", "scene-title-eyebrow", "lower-third"],
    accent: "#7c5cff",
  },
  // 2 — Setup: parallax drift, cinematic, scene-title
  {
    pattern: "parallax-drift",
    colorGrade: "cinematic",
    particles: "none",
    particleCount: 0,
    overlays: ["scene-title-eyebrow", "kinetic-caption"],
    accent: "#5cc8ff",
  },
  // 3 — Context: pulse zoom, warm grade, lower-third
  {
    pattern: "pulse-zoom",
    colorGrade: "warm",
    particles: "warm",
    particleCount: 4,
    overlays: ["scene-title-eyebrow", "lower-third"],
    accent: "#ffb454",
  },
  // 4 — Pain: glitch burst, punch grade, kinetic caption with CTA
  {
    pattern: "glitch-burst",
    colorGrade: "punch",
    particles: "mixed",
    particleCount: 8,
    overlays: ["scene-title-eyebrow", "kinetic-caption", "vignette"],
    accent: "#ff5c7a",
  },
  // 5 — Promise: ken-burns out, cinematic, scene-title + light-leak
  {
    pattern: "kenBurns-out",
    colorGrade: "cinematic",
    particles: "warm",
    particleCount: 5,
    overlays: ["scene-title-eyebrow", "lower-third", "light-leak"],
    accent: "#20e3b2",
  },
  // 6 — Proof: glide up, documentary grade, lower-third
  {
    pattern: "glide-up",
    colorGrade: "documentary",
    particles: "none",
    particleCount: 0,
    overlays: ["scene-title-eyebrow", "lower-third", "watermark"],
    accent: "#20c997",
  },
  // 7 — Objection: orbit rotate, cool grade, callout
  {
    pattern: "orbit-rotate",
    colorGrade: "cool",
    particles: "cool",
    particleCount: 4,
    overlays: ["scene-title-eyebrow", "callout"],
    accent: "#c58cff",
  },
  // 8 — Zoom (CTA): ken-burns in, punch grade, full overlay stack
  {
    pattern: "kenBurns-in",
    colorGrade: "punch",
    particles: "mixed",
    particleCount: 10,
    overlays: ["scene-title-eyebrow", "lower-third", "kinetic-caption", "vignette", "light-leak", "watermark"],
    accent: "#ff8ad4",
  },
];

/**
 * Pick the motion design for a given scene. Honors explicit override
 * (e.g. via inspector or QA revision) and otherwise picks by 1-based
 * scene index using the default library above.
 */
export function pickMotionDesign(scene: {
  index: number;
  motionPattern?: string | null;
  colorGrade?: string | null;
  particleStyle?: string | null;
  accent?: string | null;
  showWatermark?: boolean | null;
  showLowerThird?: boolean | null;
}): MotionDesign {
  const i = Math.max(1, scene.index ?? 1);
  const fallback = DEFAULT_MOTION_BY_INDEX[(i - 1) % DEFAULT_MOTION_BY_INDEX.length];
  const overrides = scene as {
    motionPattern?: string | null;
    colorGrade?: string | null;
    particleStyle?: string | null;
    accent?: string | null;
    showWatermark?: boolean | null;
    showLowerThird?: boolean | null;
  };
  return {
    ...fallback,
    pattern: (overrides.motionPattern as MotionPattern) || fallback.pattern,
    colorGrade: (overrides.colorGrade as ColorGrade) || fallback.colorGrade,
    particles: (overrides.particleStyle as ParticleStyle) ?? fallback.particles,
    accent: overrides.accent || fallback.accent,
    overlays: fallback.overlays.filter((o) => {
      if (o === "watermark") return overrides.showWatermark !== false;
      if (o === "lower-third") return overrides.showLowerThird !== false;
      return true;
    }),
  };
}

/**
 * Map a scene's beat type to the right transition into it. Beat
 * names are produced by the Scriptwriter (Pass 31: Hook, Setup,
 * Context, Pain, Promise, Proof, Objection, Zoom).
 *
 * The transition is the LAST 0.7-0.9 seconds of the previous
 * scene, applied to the entering scene's overlay (in the
 * TransitionEffect component).
 */
export const TRANSITION_BY_BEAT: Record<string, TransitionType> = {
  Hook: "zoom-blur",
  Setup: "crossfade",
  Context: "slide-left",
  Pain: "glitch-rgb",
  Promise: "particle-burst",
  Proof: "crossfade",
  Objection: "slide-up",
  Zoom: "zoom-blur",
};

export function pickTransitionForBeat(beatName?: string): TransitionType {
  if (!beatName) return "crossfade";
  return TRANSITION_BY_BEAT[beatName] ?? "crossfade";
}

/**
 * Map a CSS animation class to the pattern name. The CSS file
 * (MotionGraphics.css) defines a class per pattern name; this
 * helper is the single source of truth so the components don't
 * have to know about class-name conventions.
 */
export function patternClass(pattern: MotionPattern): string {
  return `mg-pat-${pattern}`;
}

export function transitionClass(trans: TransitionType): string {
  return `mg-trans-${trans}`;
}

export function colorGradeClass(grade: ColorGrade): string {
  return `mg-grade-${grade}`;
}
