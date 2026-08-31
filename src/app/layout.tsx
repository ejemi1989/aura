import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Studio — Agent-Native Video Production",
  description:
    "A multi-agent creative studio where 10+ specialist AI agents collaborate with humans to create video content through WebMCP tools.",
};

/**
 * Pre-hydration bootstrap.
 *
 * 1. Theme — runs synchronously before React mounts to apply the correct
 *    `.dark` class on <html>, eliminating flash-of-light-theme on dark
 *    reloads. The legacy `data-theme` attribute is kept in sync for
 *    back-compat.
 *
 * 2. WebMCP feature detection — sets a global flag the studio uses to
 *    decide whether to render the "WebMCP ready" indicator in the top
 *    nav. Doesn't actually call any APIs; just sets a flag so the UI
 *    never flickers between "checking" / "available" on first paint.
 */
const bootstrapScript = `
  (function () {
    try {
      var stored = localStorage.getItem('studio-theme');
      var theme = stored === 'dark' || stored === 'light'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var root = document.documentElement;
      root.classList.toggle('dark', theme === 'dark');
      root.setAttribute('data-theme', theme);
      root.dataset.webmcp = !!(root.modelContext) || 'pending';
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
         * Geist replaces Inter (highend.md bans Inter). Variable font
         * with weight 300–900 + OpenType features ss01/ss03/cv11.
         * Geist Mono for code; Source Serif 4 reserved for editorial
         * display moments (h1 in empty states).
         */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..900&family=Geist+Mono:wght@300..700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
