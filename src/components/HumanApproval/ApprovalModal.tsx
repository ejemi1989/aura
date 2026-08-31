"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { resolveHumanDecision } from "@/lib/webmcp/approvalBridge";
import { Button } from "@/components/common/Button";

export function ApprovalModal() {
  const pending = useStudioStore((s) => s.pendingApprovals);
  const resolveApproval = useStudioStore((s) => s.resolveApproval);
  const [rejectionMode, setRejectionMode] = useState(false);
  const [reason, setReason] = useState("");

  const current = pending[0];

  useEffect(() => {
    setRejectionMode(false);
    setReason("");
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (rejectionMode) {
          // Esc during the confirm step is a straight cancel — no decision.
          setRejectionMode(false);
        } else {
          // Esc before deciding: open the rejection step so a stray keypress
          // can never instantly reject and silently skip the confirm guard.
          setRejectionMode(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, rejectionMode]);

  if (!current) return null;

  function decide(approved: boolean) {
    resolveHumanDecision(current.id, approved);
    resolveApproval(current.id, approved);
    // Only resolve server-side via /api/webmcp/assert when this approval was
    // mirrored from an external WebMCP agent (server origin). In-app
    // approvals have no server counterpart, so we skip the call to avoid a
    // spurious 400 in the console.
    if (current.server) {
      fetch("/api/webmcp/assert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: current.id, approved }),
      }).catch(() => {});
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
    >
      <div
        className="modal-fade mx-4 w-full max-w-[480px] rounded-studio border border-border bg-card p-8 shadow-studio-md"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {labelFor(current.requestedBy)}
        </p>
        <h3
          id="approval-title"
          className="mt-1 text-lg font-semibold text-foreground"
        >
          Approval Required
        </h3>
        <p className="mt-3 text-base text-foreground">
          {current.summary}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {current.detail}
        </p>

        {rejectionMode && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (optional)…"
            className="mt-4 w-full rounded-studio border border-border bg-input p-2.5 text-sm text-foreground"
            rows={3}
            autoFocus
          />
        )}

        <div className="mt-6 flex items-center gap-2">
          {rejectionMode ? (
            <>
              <Button
                variant="outline"
                fullWidth
                onClick={() => setRejectionMode(false)}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={() => decide(false)}
                className="bg-danger text-white"
                style={{ backgroundColor: "var(--color-danger)", color: "#fff" }}
              >
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                fullWidth
                onClick={() => setRejectionMode(true)}
              >
                Reject
              </Button>
              <Button
                fullWidth
                onClick={() => decide(true)}
                className="text-white"
                style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
              >
                Approve
              </Button>
            </>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {rejectionMode
            ? "Press Esc to cancel the rejection request"
            : "Press Esc to start rejecting"}
        </p>
      </div>
    </div>
  );
}

function labelFor(id: string): string {
  switch (id) {
    case "critic-qa":
      return "Critic / QA";
    case "creative-director":
      return "Creative Director";
    case "video-editor":
      return "Video Editor";
    case "brand-strategist":
      return "Brand Strategist";
    case "scriptwriter":
      return "Scriptwriter";
    case "copywriter":
      return "Copywriter";
    case "graphic-designer":
      return "Graphic Designer";
    case "motion-graphics":
      return "Motion Graphics";
    case "voiceover":
      return "Voiceover";
    case "project-manager":
      return "Project Manager";
    default:
      return "Agent";
  }
}
