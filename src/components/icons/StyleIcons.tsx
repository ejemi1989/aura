"use client";

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Per-style icons for the Style picker. Each icon is a metaphor for
 * the style so the user can recognize the option at a glance:
 *   professional → necktie / business shirt
 *   casual        → coffee cup / relaxed
 *   dramatic      → theater masks
 *   playful       → sparkles
 *   cinematic     → film clapperboard
 */

export function ProfessionalIcon({ className, style }: IconProps) {
  // Necktie on a shirt collar — instantly reads "professional"
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M8 3l4 3 4-3" />
      <path d="M9 4l3 1 3-1" />
      <path d="M12 5l-2 16h4l-2-16z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 5l-2 16h4l-2-16z" />
      <line x1="12" y1="9" x2="12" y2="20" />
    </svg>
  );
}

export function CasualIcon({ className, style }: IconProps) {
  // T-shirt outline — relaxed, everyday
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M20.38 3.46L16 2 12 4 8 2 3.62 3.46l1.97 4.32L7 9v12h10V9l1.41-1.22 1.97-4.32z" />
      <path d="M9 6.5l3 1 3-1" />
    </svg>
  );
}

export function DramaticIcon({ className, style }: IconProps) {
  // Theater masks (comedy + tragedy) — instantly reads "dramatic"
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M3 5c2 0 4 1 5 3 1 2 1 4 0 6-1 1-3 1-5-1V5z" fill="currentColor" fillOpacity="0.12" />
      <path d="M3 5c2 0 4 1 5 3 1 2 1 4 0 6-1 1-3 1-5-1V5z" />
      <path d="M21 5c-2 0-4 1-5 3-1 2-1 4 0 6 1 1 3 1 5-1V5z" fill="currentColor" fillOpacity="0.12" />
      <path d="M21 5c-2 0-4 1-5 3-1 2-1 4 0 6 1 1 3 1 5-1V5z" />
      <circle cx="6" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6" cy="11" r="0.5" fill="currentColor" />
      <circle cx="18" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="18" cy="11" r="0.5" fill="currentColor" />
      <path d="M5 12c1 1.5 2 1.5 3 0" />
      <path d="M16 12c1 1.5 2 1.5 3 0" />
    </svg>
  );
}

export function PlayfulIcon({ className, style }: IconProps) {
  // Two sparkles — fun, energetic
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M12 2l1.8 4.5L18.5 8l-4.7 1.5L12 14l-1.8-4.5L5.5 8l4.7-1.5L12 2z"
        fillOpacity="0.25"
      />
      <path d="M12 2l1.8 4.5L18.5 8l-4.7 1.5L12 14l-1.8-4.5L5.5 8l4.7-1.5L12 2z" />
      <path
        d="M19 14l.9 2.2 2.2.9-2.2.9L19 20l-.9-2-2.2-.9 2.2-.9L19 14z"
        fillOpacity="0.25"
      />
      <path d="M19 14l.9 2.2 2.2.9-2.2.9L19 20l-.9-2-2.2-.9 2.2-.9L19 14z" />
      <path
        d="M5 16l.6 1.5 1.5.6-1.5.6L5 20l-.6-1.3-1.5-.6 1.5-.6L5 16z"
        fillOpacity="0.25"
      />
      <path d="M5 16l.6 1.5 1.5.6-1.5.6L5 20l-.6-1.3-1.5-.6 1.5-.6L5 16z" />
    </svg>
  );
}

export function CinematicIcon({ className, style }: IconProps) {
  // Film clapperboard
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M3 9.5h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill="currentColor" fillOpacity="0.1" />
      <path d="M3 9.5h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path
        d="M3.4 4l1.6 5.5h2.5L6 4h2.5l1.5 5.5h2.5L11 4h2.5l1.5 5.5h2.5L16 4h2.5l1.5 5.5H22L20.5 4H3.4z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="M3.4 4l1.6 5.5h2.5L6 4h2.5l1.5 5.5h2.5L11 4h2.5l1.5 5.5h2.5L16 4h2.5l1.5 5.5H22L20.5 4H3.4z" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  );
}

/** Map style id → icon component, with a human label. */
export const STYLE_ICONS: Record<string, { Icon: (p: IconProps) => JSX.Element; label: string }> = {
  professional: { Icon: ProfessionalIcon, label: "Professional" },
  casual: { Icon: CasualIcon, label: "Casual" },
  dramatic: { Icon: DramaticIcon, label: "Dramatic" },
  playful: { Icon: PlayfulIcon, label: "Playful" },
  cinematic: { Icon: CinematicIcon, label: "Cinematic" },
};

/** Brand-y colors for each style — used as the icon tint when active. */
export const STYLE_COLORS: Record<string, string> = {
  professional: "#475569", // slate
  casual: "#f59f0b",       // warm amber
  dramatic: "#dc2626",     // crimson
  playful: "#a855f7",      // violet
  cinematic: "#0ea5e9",    // sky
};
