"use client";

import clsx from "clsx";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-block animate-spin", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className="text-primary"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
