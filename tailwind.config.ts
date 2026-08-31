import type { Config } from "tailwindcss";

/**
 * Tailwind config.
 *
 * Two design documents anchor every choice:
 *   - .context/design/tailwind.md — semantic token system, CSS-first config
 *   - .context/design/typography.md — type scale, line-height, measure rules
 *   - .context/design/highend.md   — premium aesthetic, custom cubic-beziers,
 *                                    GPU-safe animation, Double-Bezel cards
 *
 * Every color and elevation lives in `src/app/globals.css` as an OKLCH CSS
 * custom property on `:root` / `.dark`. Tailwind utilities resolve through
 * `var()` so light/dark pivots are a one-token swap. Don't add raw color
 * literals here — extend the palette in globals.css and reference it.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "var(--color-success-foreground)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "var(--color-warning-foreground)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          foreground: "var(--color-danger-foreground)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          foreground: "var(--color-info-foreground)",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        studio: "var(--radius)",
        // Premium squircle radii for high-end cards (per highend.md)
        squircle: "1.75rem",
      },
      boxShadow: {
        DEFAULT: "var(--shadow-sm)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        // Hairline + inner highlight for the Double-Bezel pattern
        bezel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(0,0,0,0.04)",
        "studio-sm": "var(--shadow-sm)",
        "studio-md": "var(--shadow-md)",
      },
      ringOffsetColor: {
        DEFAULT: "var(--color-background)",
        background: "var(--color-background)",
      },
      fontFamily: {
        // Geist replaces Inter (Inter is on the highend.md banned list).
        // Variable font, 300–900, with proper OpenType features.
        sans: [
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        // Editorial serif for occasional high-end display moments.
        display: ['"Source Serif 4"', "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        // Semantic type scale, per typography.md Principle 5.
        // Names describe use, not size, so the rules stay consistent.
        "display-2xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-xl":  ["3rem",    { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "600" }],
        "display-lg":  ["2.25rem", { lineHeight: "1.1",  letterSpacing: "-0.02em",  fontWeight: "600" }],
        "display":     ["1.875rem",{ lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" }],
        "title":       ["1.5rem",  { lineHeight: "1.2",  letterSpacing: "-0.01em",  fontWeight: "600" }],
        "subtitle":    ["1.125rem",{ lineHeight: "1.3",  letterSpacing: "-0.005em", fontWeight: "500" }],
        "body":        ["0.875rem",{ lineHeight: "1.55", letterSpacing: "0",         fontWeight: "400" }],
        "body-sm":     ["0.8125rem",{ lineHeight: "1.5", letterSpacing: "0",        fontWeight: "400" }],
        "caption":     ["0.75rem", { lineHeight: "1.4",  letterSpacing: "0",         fontWeight: "400" }],
        "overline":    ["0.6875rem",{ lineHeight: "1.3", letterSpacing: "0.08em",    fontWeight: "500" }],
      },
      fontFamilyFeatureSettings: {
        // Default ON features for the whole body — uses CSS property
        // syntax so non-variable fallbacks still pick them up.
        default: '"cv11", "ss01", "ss03"',
      },
      // Premium easing — no `linear`, no plain `ease-in-out`. Per highend.md.
      transitionTimingFunction: {
        // Apple's standard easing curve, the tasteful choice for app UI.
        apple: "cubic-bezier(0.32, 0.72, 0, 1)",
        // Linear with a tiny out-back for things that pop in.
        "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        // Expressive entry for hero motion (heavy + decelerating).
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        "500": "500ms",
        "700": "700ms",
      },
      keyframes: {
        "modal-fade": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "dot-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Entry animation — highend.md §5.C (gentle fade-up + blur resolve).
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(1rem)", filter: "blur(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
      },
      animation: {
        "modal-fade": "modal-fade 0.15s ease-out",
        "dot-pulse": "dot-pulse 1.5s ease-in-out infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
