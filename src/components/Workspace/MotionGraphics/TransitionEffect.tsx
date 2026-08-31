"use client";

import { type ReactNode } from "react";
import { transitionClass, type TransitionType } from "./patterns";

interface TransitionEffectProps {
  type: TransitionType;
  /** Set to the previous scene's beat name so transitions can be
   *  cross-faded with the new scene's overlay. */
  children: ReactNode;
  /** Force the transition to play even on first scene render. */
  alwaysAnimate?: boolean;
}

/**
 * Wraps the entering scene's content with a CSS transition class
 * so when the active scene changes, the new scene visually enters
 * via the configured transition. The class is keyed to the
 * transition type; keying is done in the parent so React remounts
 * the wrapper on every scene change, replaying the entry animation.
 *
 * Each transition type is mapped to a CSS keyframe in
 * MotionGraphics.css. Default is "crossfade" — a clean 0.7s opacity
 * blend that works for any pair of scenes.
 */
export function TransitionEffect({
  type,
  children,
  alwaysAnimate,
}: TransitionEffectProps) {
  return (
    <div
      className={`relative h-full w-full ${transitionClass(type)}`}
      data-mg-transition={type}
      data-mg-always-animate={alwaysAnimate ? "1" : "0"}
    >
      {children}
    </div>
  );
}
