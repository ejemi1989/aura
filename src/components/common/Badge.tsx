"use client";

import clsx from "clsx";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "purple";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-primary/10 text-primary",
  green: "bg-success/10 text-success",
  amber: "bg-warning/10 text-warning",
  red: "bg-danger/10 text-danger",
  purple: "bg-info/10 text-info",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
