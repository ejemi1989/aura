"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/lib/store/useStudioStore";

/**
 * Mirrors the server-side WebMCP agent state into the client store so an
 * external agent's tool calls and artifacts "show up in the studio." Polls
 * /api/webmcp/get_state and calls store.hydrateFrom.
 *
 * Guarded so it never fights the in-app Creative Director:
 *  - suppressed entirely while `isDirecting` is true (in-app orchestrator),
 *  - only hydrates once the server actually has a started project / activity,
 *    so it can't blank a fresh client session.
 */
export function useExternalSync(intervalMs = 700) {
  const started = useRef(false);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      const state = useStudioStore.getState();
      // Never fight an in-app Director run...
      if (state.isDirecting) return;

      // ...and only mirror the external agent into an otherwise-empty Control
      // Room. This keeps the two demos cleanly separated: an external run
      // hydrates a blank session, but can't clobber a finished in-app one.
      const clientIdle =
        state.project.phase === "not_started" &&
        state.project.scenes.length === 0 &&
        state.activity.length === 0 &&
        state.pendingApprovals.length === 0;
      if (!clientIdle) return;

      try {
        const res = await fetch("/api/webmcp/get_state", { cache: "no-store" });
        if (!res.ok) return;
        const snap = await res.json();
        if (!snap?.ok) return;

        const serverBusy =
          snap.project.phase !== "not_started" ||
          (snap.project.scenes?.length ?? 0) > 0 ||
          (snap.activity?.length ?? 0) > 0 ||
          (snap.pendingApprovals?.length ?? 0) > 0;

        if (!serverBusy) return;

        // Adopt the server's project id once, so we never flash a different
        // project identity on first hydrate.
        if (!started.current) started.current = true;

        useStudioStore
          .getState()
          .hydrateFrom({
            project: snap.project,
            agentStatus: snap.agentStatus,
            activity: snap.activity,
            pendingApprovals: snap.pendingApprovals,
            toolCalls: snap.toolCalls,
          });
      } catch {
        // The server may be temporarily unavailable (dev reload, cold start).
        // Keep polling — the next tick will recover.
      }
    }

    // Fire immediately, then poll on an interval.
    poll();
    timer = setInterval(poll, intervalMs);

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
