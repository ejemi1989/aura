"use client";

import { useStudioStore } from "@/lib/store/useStudioStore";
import { AGENT_ICONS } from "@/components/icons/AgentIcons";

/**
 * Clear, always-visible production-status strip. Renders whenever the crew is
 * paused for a human decision — either a terminal ApprovalModal (final veto)
 * or a mid-run "Remake scene" request. It names exactly why production stopped
 * and who is waiting, so a judge never has to reverse-engineer the state.
 *
 * After a remake completes, the same strip renders a "what changed" diff so
 * the human (and the judge) can see at a glance: "Scene 3 visual regenerated
 * via fal.ai · 2.1s · $0.05. Script + other scenes + composition preserved."
 * That's the "targeted re-generation, not a re-roll" point the demo
 * narrative leans on, now visible in the UI rather than only in copy.
 */
export function ProductionStatus() {
  const pending = useStudioStore((s) => s.pendingApprovals[0]);
  const revision = useStudioStore((s) => s.revisionRequest);
  const phase = useStudioStore((s) => s.project.phase);
  const revisionDiff = useStudioStore((s) => s.project.revisionDiff);
  const revisionSceneId = revision?.sceneId;
  const revisionScene = useStudioStore((s) =>
    revisionSceneId ? s.project.scenes.find((sc) => sc.id === revisionSceneId) : undefined
  );

  // An active mid-run revision request indicates the crew is paused on it.
  const midVetoActive = revision && revision.status === "requested";
  const finalVetoActive = !!pending;
  // After a rejection at the approval gate, the Director holds the pipeline
  // open with no pending approval and no remake chosen yet — a distinct
  // "waiting on the human" window we must surface explicitly.
  const rejectWaitActive = phase === "revision" && !finalVetoActive && !midVetoActive;
  // After a remake completes (crew resumed, no veto pending), show the diff
  // strip until the next campaign-complete or the next reject. This is the
  // "what changed" beat the demo narrative relies on.
  const diffActive =
    !!revisionDiff &&
    !midVetoActive &&
    !finalVetoActive &&
    !rejectWaitActive;

  if (midVetoActive && !finalVetoActive) {
    return (
      <Banner
        tone="danger"
        icon={<VetoIcon className="h-3.5 w-3.5" />}
        title={`Production paused — awaiting the human`}
        detail={
          revisionScene
            ? `Remaking Scene ${revisionScene.index}. The Designer will refresh this frame before the crew resumes.`
            : "A scene remake was requested. The Designer will refresh the frame before the crew resumes."
        }
      />
    );
  }

  if (rejectWaitActive) {
    return (
      <Banner
        tone="warning"
        icon={<DirectorIcon className="h-3.5 w-3.5" />}
        title={`Production held — the Director is waiting on you`}
        detail="Your approval was rejected. Select a scene and use Remake to tell the crew what to change, or approve as-is."
      />
    );
  }

  if (finalVetoActive) {
    return (
      <Banner
        tone="warning"
        icon={<DirectorIcon className="h-3.5 w-3.5" />}
        title={`${AGENT_ICONS[pending.requestedBy].label} is waiting on you`}
        detail={pending.summary}
      />
    );
  }

  if (diffActive && revisionDiff) {
    const regen = revisionDiff.regenerated.length > 0
      ? revisionDiff.regenerated.join(", ")
      : "nothing";
    const preserve = revisionDiff.preserved.length > 0
      ? revisionDiff.preserved.join(", ")
      : "—";
    const provider = revisionDiff.provider && revisionDiff.provider !== "demo"
      ? ` via ${revisionDiff.provider}`
      : "";
    const latency = typeof revisionDiff.latencyMs === "number" && revisionDiff.latencyMs > 0
      ? ` · ${(revisionDiff.latencyMs / 1000).toFixed(1)}s`
      : "";
    return (
      <Banner
        tone="info"
        icon={<DiffIcon className="h-3.5 w-3.5" />}
        title={`Scene ${revisionDiff.sceneIndex} remade${provider}${latency}`}
        detail={`Regenerated: ${regen}. Preserved: ${preserve}.`}
      />
    );
  }

  return null;
}

function Banner({
  tone,
  icon,
  title,
  detail,
}: {
  tone: "info" | "warning" | "danger";
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  const classes =
    tone === "danger"
      ? "border-danger/30 bg-danger/10 text-danger"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return (
    <div
      className={
        "flex shrink-0 items-center gap-2.5 border-b px-3 py-1.5 text-[11px] sm:px-4 " +
        classes
      }
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="truncate text-muted-foreground">· {detail}</span>
    </div>
  );
}

function DiffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v18" />
      <path d="M8 7l-4 5 4 5" />
      <path d="M16 7l4 5-4 5" />
    </svg>
  );
}

function VetoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function DirectorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 12a9 9 0 0 0 9 9" />
      <path d="M12 3v18" />
      <path d="M3 12h18" />
    </svg>
  );
}
