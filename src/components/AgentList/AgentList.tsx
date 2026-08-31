"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { AGENT_ORDER } from "@/lib/agents/registry";
import type { AgentId, AgentStatus } from "@/types";
import { AGENT_ICONS } from "@/components/icons/AgentIcons";

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  planning: "Planning",
  active: "Working",
  completed: "Done",
  error: "Error",
  blocked: "Waiting",
};

const STATUS_TONE: Record<AgentStatus, string> = {
  idle: "bg-muted-foreground text-muted-foreground",
  planning: "bg-warning text-warning",
  active: "bg-primary text-primary",
  completed: "bg-success text-success",
  error: "bg-danger text-danger",
  blocked: "bg-warning text-warning",
};

type Filter = "all" | "active" | "done" | "issues";

export function AgentList() {
  const agentStatus = useStudioStore((s) => s.agentStatus);
  const activity = useStudioStore((s) => s.activity);
  const setAgentStatus = useStudioStore((s) => s.setAgentStatus);
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<AgentId | null>(null);

  const lastMessageFor = (id: AgentId) =>
    [...activity].reverse().find((a) => a.agentId === id)?.message;

  const orderedIds: AgentId[] = useMemo(
    () => ["creative-director", ...AGENT_ORDER, "project-manager"],
    []
  );

  const visible = useMemo(() => {
    return orderedIds.filter((id) => {
      const s = agentStatus[id];
      if (filter === "all") return true;
      if (filter === "active") return s === "active" || s === "planning";
      if (filter === "done") return s === "completed";
      if (filter === "issues") return s === "error" || s === "blocked";
      return true;
    });
  }, [orderedIds, agentStatus, filter]);

  useEffect(() => {
    const activeIndex = orderedIds.findIndex(
      (id) => agentStatus[id] === "active" || agentStatus[id] === "planning"
    );
    if (activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-agent="${orderedIds[activeIndex]}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [agentStatus, orderedIds]);

  const activeCount = orderedIds.filter(
    (id) => agentStatus[id] === "active" || agentStatus[id] === "planning"
  ).length;
  const doneCount = orderedIds.filter((id) => agentStatus[id] === "completed").length;
  const errorCount = orderedIds.filter(
    (id) => agentStatus[id] === "error" || agentStatus[id] === "blocked"
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <SwarmIcon className="h-4 w-4" />
            Agent Swarm
          </h2>
          <span
            className={clsx(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              activeCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            {activeCount}/10 active
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {activeCount > 0 ? (
            <>
              <span className="font-medium text-primary">{activeCount}</span> working{" · "}
              <span className="font-medium text-success">{doneCount}</span> done
              {errorCount > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-danger">{errorCount}</span> issue{errorCount === 1 ? "" : "s"}
                </>
              )}
            </>
          ) : doneCount > 0 ? (
            <>
              <span className="font-medium text-success">{doneCount}</span> done{" · "}
              <span className="text-muted-foreground">{orderedIds.length - doneCount}</span> idle
            </>
          ) : (
            "Live status across all 10 specialists"
          )}
        </p>
        {/* Filter chips */}
        <div className="-mx-0.5 flex flex-wrap items-center gap-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: `Active (${activeCount})` },
              { id: "done", label: `Done (${doneCount})` },
              { id: "issues", label: `Issues (${errorCount})` },
            ] as { id: Filter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-base",
                filter === f.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
            No agents in this state.
          </div>
        ) : (
          visible.map((id) => (
            <AgentItem
              key={id}
              agentId={id}
              status={agentStatus[id]}
              action={lastMessageFor(id)}
              expanded={expanded === id}
              onToggle={() => setExpanded((p) => (p === id ? null : id))}
              onActivate={() => {
                if (agentStatus[id] === "idle") {
                  setAgentStatus(id, "active", "Manually engaged");
                  window.setTimeout(() => setAgentStatus(id, "completed", "Manually disengaged"), 1200);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AgentItem({
  agentId,
  status,
  action,
  expanded,
  onToggle,
  onActivate,
}: {
  agentId: AgentId;
  status: AgentStatus;
  action?: string;
  expanded: boolean;
  onToggle: () => void;
  onActivate?: () => void;
}) {
  const isActive = status === "active" || status === "planning";
  const meta = AGENT_ICONS[agentId];
  const { Icon, label, role } = meta;
  // Default unknown statuses (e.g. legacy state files that pre-date a
  // new agent being added) to "idle" so the row still renders cleanly.
  const tone = (STATUS_TONE[status ?? "idle"] ?? STATUS_TONE.idle).split(" ")[1];

  return (
    <div
      data-agent={agentId}
      className={clsx(
        "mb-1 rounded-md border transition-base",
        isActive
          ? "border-primary/30 bg-primary/8"
          : status === "error"
          ? "border-danger/30 bg-danger/5"
          : "border-border bg-card hover:border-border/80"
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        title={`${label} — ${role}`}
        className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left"
      >
        <div
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-base",
            isActive
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-background"
          )}
        >
          <Icon
            className={clsx(
              "h-4 w-4",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                STATUS_TONE[status ?? "idle"].split(" ")[0],
                isActive && "dot-pulse"
              )}
            />
            <span className="truncate text-[13px] font-medium text-foreground">{label}</span>
            <span
              className={clsx(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                isActive
                  ? "bg-primary/15 text-primary"
                  : status === "completed"
                  ? "bg-success/15 text-success"
                  : status === "error"
                  ? "bg-danger/15 text-danger"
                  : "bg-background text-muted-foreground"
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          {/* Full action text — wraps, never truncates, so users can read
              what each agent just did without hovering for a tooltip. */}
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {action ?? role}
          </p>
          {isActive && (
            <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full bg-primary transition-width"
                style={{ width: progressFor(status) }}
              />
            </div>
          )}
        </div>
      </button>

      {/* Expandable detail — shows the agent's full role and any other
          context. Reachable via click on the body, or by the dedicated
          "details" handle below. */}
      {expanded && (
        <div className="border-t border-border px-2.5 py-2 text-[11px]">
          <p className="font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-muted-foreground">{role}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            id: <code className="font-mono">{agentId}</code> · status: {status}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/60 px-2.5 py-1 text-[10px]">
        <span className={tone}>{role}</span>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Less" : "Details"}
        </button>
      </div>
    </div>
  );
}

function progressFor(status: AgentStatus) {
  if (status === "active") return "65%";
  if (status === "planning") return "25%";
  if (status === "blocked") return "40%";
  return "0%";
}

function SwarmIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="13" r="2.5" />
      <circle cx="6" cy="20" r="2.5" />
      <circle cx="18" cy="20" r="2.5" />
      <line x1="7.8" y1="7.2" x2="10.2" y2="11.8" />
      <line x1="16.2" y1="7.2" x2="13.8" y2="11.8" />
      <line x1="7.8" y1="18.8" x2="10.2" y2="14.2" />
      <line x1="16.2" y1="18.8" x2="13.8" y2="14.2" />
    </svg>
  );
}
