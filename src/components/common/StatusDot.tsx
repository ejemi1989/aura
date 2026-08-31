"use client";

import clsx from "clsx";
import type { AgentStatus } from "@/types";

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground",
  planning: "bg-warning",
  active: "bg-primary",
  completed: "bg-success",
  error: "bg-danger",
  blocked: "bg-warning",
};

export function StatusDot({
  status,
  pulse = true,
  className,
}: {
  status: AgentStatus;
  pulse?: boolean;
  className?: string;
}) {
  const isPulsing = pulse && (status === "active" || status === "planning" || status === "blocked");
  return (
    <span
      className={clsx(
        "inline-block h-2 w-2 rounded-full transition-base",
        STATUS_COLOR[status],
        isPulsing && "dot-pulse",
        className
      )}
      aria-label={`Status: ${status}`}
      role="img"
    />
  );
}
