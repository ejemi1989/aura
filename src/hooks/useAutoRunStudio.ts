"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { runCreativeDirector } from "@/lib/agents/directorOrchestrator";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaignTemplates";
import type { CreativeBrief } from "@/types";

/**
 * Auto-runs the REAL Creative Director pipeline on page load so a judge
 * (or reviewer) opening the studio on a fresh session watches the actual
 * WebMCP agents work end to end — not a scripted replay.
 *
 * This replaces the old presentation `useAgentReplay`, which faked a
 * staged pipeline over a pre-built fixture. The honest flow here runs the
 * genuine tool pipeline and then STOPS at the Human Veto gate — the
 * director holds there and the on-screen approval modal lets the judge
 * click Approve/Reject themselves, preserving the human-in-the-loop
 * showcase rather than auto-approving behind their back.
 *
 * Env-gated so normal development and the idle-expecting test gates stay
 * green (idle on load, manual Run flow). Enable it with either:
 *   NEXT_PUBLIC_AUTO_RUN_STUDIO=true   (env; inlined at build time)
 *   ?autoRun=1                         (URL query param; no restart needed)
 * Use one of them on the competition deployment / judge URL for the
 * immersive auto-run demo.
 *
 * Guardrails:
 *  - Fires at most once per session, after a short settle delay so the
 *    external sync / initial hydration lands first.
 *  - Only fires when BOTH the client and server projects are blank
 *    (phase "not_started", no scenes, no activity/approvals). A populated
 *    or completed project is never clobbered — the user's real work stands.
 *  - Stands down if an in-app Director run is already in flight, so a
 *    manual "Run Studio" click that beat the auto-run wins cleanly
 *    (create_project's resetProject makes re-entry idempotent anyway).
 */
export function useAutoRunStudio() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Disabled unless explicitly opted in via env OR a ?autoRun=1 query.
    const byEnv = process.env.NEXT_PUBLIC_AUTO_RUN_STUDIO === "true";
    const byQuery =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("autoRun") === "1";
    if (!byEnv && !byQuery) return;


    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function maybeRun() {
      const state = useStudioStore.getState();

      // Never fight an in-app Director run already in flight.
      if (state.isDirecting) return;

      // Only auto-run a genuinely blank session. If the client already
      // has a populated/finished project, respect it.
      const clientBlank =
        state.project.phase === "not_started" &&
        state.project.scenes.length === 0 &&
        state.activity.length === 0 &&
        state.pendingApprovals.length === 0;
      if (!clientBlank) return;

      // And only when the server is equally blank — a pre-built server
      // fixture that represents real (possibly completed) work should be
      // shown as-is, never overwritten on load.
      let serverBlank = true;
      try {
        const res = await fetch("/api/webmcp/get_state", { cache: "no-store" });
        if (res.ok) {
          const snap = await res.json();
          if (snap?.ok && snap.project) {
            serverBlank =
              snap.project.phase === "not_started" &&
              (snap.project.scenes?.length ?? 0) === 0 &&
              (snap.activity?.length ?? 0) === 0 &&
              (snap.pendingApprovals?.length ?? 0) === 0;
          }
        }
      } catch {
        // Server may be warming up (dev reload / cold start). If we can't
        // prove it's busy, fall through to the client-blank auto-run.
      }
      if (cancelled) return;
      if (!serverBlank) return;

      // Re-check after the server probe — a real run may have started.
      if (useStudioStore.getState().isDirecting) return;

      // Run the real pipeline. It will reach the Human Veto gate and hold
      // there for the judge's approval — the full swarm, tool calls, and
      // artifacts stream live in the control room up to that point.
      const brief = CAMPAIGN_TEMPLATES[0];
      await runCreativeDirector({
        name: brief.name,
        goal: brief.goal,
        audience: brief.audience,
        platform: brief.platform,
        style: brief.style,
        targetDurationSeconds: brief.targetDurationSeconds ?? 30,
      } satisfies CreativeBrief & { name: string });
    }

    // Give the control room a beat to mount and settle (external sync,
    // hydrations) before the pipeline kicks off — reads as live work, not
    // a flash on first paint.
    timer = setTimeout(() => {
      void maybeRun();
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
}
