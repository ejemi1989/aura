"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "studio-theme";
const DARK_CLASS = "dark";

/**
 * Per the design-system recommendation (see .context/design/tailwind.md):
 *
 *   "@custom-variant dark (&:where(.dark, .dark *))"
 *
 * Tailwind's `darkMode: "class"` matches a `.dark` class on the html
 * element. The previous implementation toggled a `data-theme="dark"`
 * attribute; we keep both for back-compat with any cached SSR markup
 * but the class is now the source of truth.
 */

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  if (document.documentElement.classList.contains(DARK_CLASS)) return "dark";
  const stored = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  if (stored === "dark" || stored === "light") return stored;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readInitialTheme());
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.classList.toggle(DARK_CLASS, next === "dark");
        // Keep the legacy attribute in sync so any pre-existing CSS that
        // targets `[data-theme="dark"]` keeps working through the
        // transition. New code should prefer the class.
        root.setAttribute("data-theme", next);
      }
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return { theme, toggleTheme, mounted };
}
