"use client";

import { useStudioStore } from "@/lib/store/useStudioStore";

export function ScriptEditor() {
  const script = useStudioStore((s) => s.project.script);
  const qaVerdict = useStudioStore((s) => s.project.qaVerdict);
  const qaNotes = useStudioStore((s) => s.project.qaNotes);

  return (
    <div className="h-full overflow-y-auto p-4">
      {script ? (
        <pre className="whitespace-pre-wrap rounded-studio border border-border bg-card p-4 font-mono text-[13px] leading-6 text-foreground">
          {script}
        </pre>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No script yet. The Scriptwriter drafts once the brand guidelines are set.
        </div>
      )}

      {qaVerdict && (
        <div className="mt-3 rounded-studio border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              QA Verdict
            </span>
            <span
              className={
                qaVerdict === "APPROVED"
                  ? "text-xs font-medium text-success"
                  : "text-xs font-medium text-warning"
              }
            >
              {qaVerdict}
            </span>
          </div>
          {(qaNotes ?? []).length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-muted-foreground">
              {(qaNotes ?? []).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
