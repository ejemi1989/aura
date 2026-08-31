"use client";

import type { AgentId } from "@/types";

/**
 * Per-agent icons. Each specialist has a unique visual mark so the
 * swarm list reads at a glance — the Director can be told apart from
 * the Critic at a glance, not just by reading the name.
 *
 * Icons are 16×16 by default, use currentColor, and are designed
 * to read at small sizes (used both in the swarm list and the
 * Activity feed).
 */

interface IconProps {
  className?: string;
}

const wrap = (children: React.ReactNode, className?: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {children}
  </svg>
);

export function DirectorIcon({ className }: IconProps) {
  // Compass / orchestrator
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" fillOpacity="0.2" />
      <polygon points="16.24,7.76 14.12,14.12 9.88,9.88" fill="currentColor" />
    </>,
    className
  );
}

export function BrandIcon({ className }: IconProps) {
  // Compass / strategy
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.7 6.3-6.3 2.7 2.7-6.3 6.3-2.7Z" fill="currentColor" fillOpacity="0.2" />
      <path d="m15.5 8.5-2.7 6.3-6.3 2.7 2.7-6.3 6.3-2.7Z" />
    </>,
    className
  );
}

export function ScriptIcon({ className }: IconProps) {
  // Document with lines
  return wrap(
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </>,
    className
  );
}

export function CopyIcon({ className }: IconProps) {
  // Pen / pencil
  return wrap(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>,
    className
  );
}

export function DesignIcon({ className }: IconProps) {
  // Frame / image
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>,
    className
  );
}

export function MotionIcon({ className }: IconProps) {
  // Play / video
  return wrap(
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m22 8-6 4 6 4V8Z" fill="currentColor" fillOpacity="0.2" />
      <path d="m22 8-6 4 6 4V8Z" />
    </>,
    className
  );
}

export function VoiceIcon({ className }: IconProps) {
  // Microphone
  return wrap(
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </>,
    className
  );
}

export function EditorIcon({ className }: IconProps) {
  // Scissors / cut
  return wrap(
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </>,
    className
  );
}

export function CriticIcon({ className }: IconProps) {
  // Shield with check
  return wrap(
    <>
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z" />
      <polyline points="9 12 11 14 15 10" />
    </>,
    className
  );
}

export function PMIcon({ className }: IconProps) {
  // Clipboard / kanban
  return wrap(
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="13" y2="14" />
    </>,
    className
  );
}

/** Map agent id → icon component, with full role label as title text. */
export const AGENT_ICONS: Record<AgentId, { Icon: (p: IconProps) => JSX.Element; label: string; role: string }> = {
  "creative-director": { Icon: DirectorIcon, label: "Director", role: "Orchestrator" },
  "brand-strategist": { Icon: BrandIcon, label: "Brand", role: "Positioning & guidelines" },
  scriptwriter: { Icon: ScriptIcon, label: "Writer", role: "Narrative & script" },
  copywriter: { Icon: CopyIcon, label: "Copy", role: "Captions & on-screen text" },
  "graphic-designer": { Icon: DesignIcon, label: "Design", role: "Key visuals" },
  "motion-graphics": { Icon: MotionIcon, label: "Motion", role: "Video generation" },
  voiceover: { Icon: VoiceIcon, label: "Voice", role: "Narration audio" },
  "video-editor": { Icon: EditorIcon, label: "Editor", role: "Assembly" },
  "critic-qa": { Icon: CriticIcon, label: "Critic", role: "Quality gate" },
  "project-manager": { Icon: PMIcon, label: "PM", role: "Status & roadmap" },
};
