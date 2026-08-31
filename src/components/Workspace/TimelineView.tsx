"use client";

import { useStudioStore } from "@/lib/store/useStudioStore";

const PHASES = [
  "not_started",
  "brand",
  "script",
  "storyboard",
  "assets",
  "voiceover",
  "assembly",
  "review",
  "revision",
  "approved",
  "complete",
] as const;

export function TimelineView() {
  const project = useStudioStore((s) => s.project);
  const scenes = project.scenes;
  const currentIndex = PHASES.indexOf(project.phase);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-studio border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Production phase</span>
          <span className="font-mono text-muted-foreground">
            {currentIndex + 1} / {PHASES.length}
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full bg-primary transition-width"
            style={{ width: `${((currentIndex + 1) / PHASES.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-3">
          {PHASES.slice(1).map((p, i) => {
            const idx = i + 1;
            const state = idx < currentIndex ? "done" : idx === currentIndex ? "active" : "todo";
            return (
              <div
                key={p}
                className={
                  state === "active"
                    ? "font-medium text-primary"
                    : state === "done"
                    ? "text-success"
                    : "text-muted-foreground"
                }
              >
                {state === "done" ? "✓ " : state === "active" ? "● " : "○ "}
                {p.replace("_", " ")}
              </div>
            );
          })}
        </div>
      </div>

      {scenes.length > 0 && (
        <div className="rounded-studio border border-border bg-card p-3">
          <div className="mb-2 text-xs text-muted-foreground">Scene timeline</div>
          <div className="flex h-12 overflow-hidden rounded-md border border-border">
            {scenes.map((s, i) => {
              const ready = s.videoUrl && s.voiceoverUrl;
              const color = ready
                ? "var(--color-success)"
                : s.videoUrl || s.voiceoverUrl
                ? "var(--color-warning)"
                : "var(--color-muted)";
              return (
                <div
                  key={s.id}
                  className="flex-1 border-r border-card last:border-r-0"
                  style={{ backgroundColor: color }}
                  title={`Scene ${s.index}`}
                >
                  <div className="flex h-full items-center justify-center text-[10px] font-medium text-white">
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>0:00</span>
            <span>{scenes.length * 5}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
