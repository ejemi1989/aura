"use client";

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

export function CampaignIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </>,
    className
  );
}

export function TargetIcon({ className }: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>,
    className
  );
}

export function UsersIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
    className
  );
}

export function PlatformIcon({ className }: IconProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </>,
    className
  );
}

export function PaletteIcon({ className }: IconProps) {
  return wrap(
    <>
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z" />
    </>,
    className
  );
}

export function ClockIcon({ className }: IconProps) {
  return wrap(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>,
    className
  );
}

export function SparkleIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 16l.8 2 2 .8-2 .8L19 22l-.8-2-2-.8 2-.8L19 16z" fill="currentColor" fillOpacity="0.2" />
      <path d="M19 16l.8 2 2 .8-2 .8L19 22l-.8-2-2-.8 2-.8L19 16z" />
    </>,
    className
  );
}

/* Inspector (right rail) icons */

export function ScissorsIcon({ className }: IconProps) {
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

export function VolumeIcon({ className }: IconProps) {
  return wrap(
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </>,
    className
  );
}

export function TypeIcon({ className }: IconProps) {
  return wrap(
    <>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </>,
    className
  );
}

export function ZapIcon({ className }: IconProps) {
  return wrap(
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />,
    className
  );
}

export function RefreshIcon({ className }: IconProps) {
  return wrap(
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>,
    className
  );
}

export function ImageIcon({ className }: IconProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>,
    className
  );
}

/* Timeline icons */

export function PlayIcon({ className }: IconProps) {
  return wrap(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />, className);
}

export function PauseIcon({ className }: IconProps) {
  return wrap(
    <>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </>,
    className
  );
}

export function SkipBackIcon({ className }: IconProps) {
  return wrap(
    <>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </>,
    className
  );
}

export function SkipForwardIcon({ className }: IconProps) {
  return wrap(
    <>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>,
    className
  );
}

export function SplitIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M12 3v18" />
      <path d="M3 7h6l3 5-3 5H3" />
      <path d="M21 7h-6l-3 5 3 5h6" />
    </>,
    className
  );
}

export function MagnetLeftIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M3 7v5a9 9 0 0 0 18 0V7" />
      <line x1="3" y1="7" x2="9" y2="7" />
      <line x1="15" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </>,
    className
  );
}

export function MagnetRightIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M21 7v5a9 9 0 0 1-18 0V7" />
      <line x1="3" y1="7" x2="9" y2="7" />
      <line x1="15" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </>,
    className
  );
}

export function TrashIcon({ className }: IconProps) {
  return wrap(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>,
    className
  );
}

export function PlusIcon({ className }: IconProps) {
  return wrap(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>,
    className
  );
}

export function ZoomInIcon({ className }: IconProps) {
  return wrap(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
    className
  );
}

export function ZoomOutIcon({ className }: IconProps) {
  return wrap(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
    className
  );
}

/* Tab icons */

export function GridIcon({ className }: IconProps) {
  return wrap(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
    className
  );
}

export function DocIcon({ className }: IconProps) {
  return wrap(
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>,
    className
  );
}

export function WaveIcon({ className }: IconProps) {
  return wrap(
    <>
      <line x1="3" y1="12" x2="3" y2="12" />
      <line x1="6" y1="9" x2="6" y2="15" />
      <line x1="9" y1="6" x2="9" y2="18" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="15" y1="7" x2="15" y2="17" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="21" y1="9" x2="21" y2="15" />
    </>,
    className
  );
}

export function BarsIcon({ className }: IconProps) {
  return wrap(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>,
    className
  );
}
