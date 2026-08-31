import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class name helper, per the design-system recommendation
 * (see .context/design/tailwind.md). Combines:
 *
 *   • `clsx`  — turns conditional class strings into a flat deduped array
 *   • `twMerge` — collapses conflicting Tailwind utilities so the last
 *                  one wins (e.g. `cn("px-2", "px-4")` → "px-4")
 *
 * Use it everywhere instead of raw `clsx(...)` so utility conflicts
 * resolve deterministically and the output is what the dev intended.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared focus-ring utility — applied via `focus-ring` on every
 * interactive element. Implemented as a string so it composes cleanly
 * with `cn(...)`.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Disabled state utility — applied to interactive elements via `disabled-ui`
 * or composed manually.
 */
export const disabledUi =
  "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed";
