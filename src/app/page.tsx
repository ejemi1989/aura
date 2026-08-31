"use client";

import { useState } from "react";
import { useWebMCP } from "@/hooks/useWebMCP";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useAutoRunStudio } from "@/hooks/useAutoRunStudio";
import { TopNav } from "@/components/TopNav/TopNav";
import { AgentList } from "@/components/AgentList/AgentList";
import { Workspace } from "@/components/Workspace/Workspace";
import { BottomBar } from "@/components/BottomBar/BottomBar";
import { ApprovalModal } from "@/components/HumanApproval/ApprovalModal";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import { BriefPanel } from "@/components/Chat/BriefPanel";
import { DemoModeBanner } from "@/components/Banner/DemoModeBanner";
import { ProductionStatus } from "@/components/Banner/ProductionStatus";

export default function Page() {
  const webmcp = useWebMCP();
  const [mobileView, setMobileView] = useState<"workspace" | "agents" | "brief">("workspace");

  // Mirror the server-side WebMCP agent's state into the Control Room so an
  // external agent's calls and artifacts appear live (suppressed during an
  // in-app Director run).
  useExternalSync();
  // Auto-run the REAL Creative Director pipeline on a fresh session so a
  // judge opening the studio watches the actual WebMCP agents work end to
  // end — pausing at the Human Veto gate for the judge's approve/reject.
  // Env-gated (NEXT_PUBLIC_AUTO_RUN_STUDIO=true or ?autoRun=1); stands down
  // for any populated/completed project or existing run.
  useAutoRunStudio();

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopNav
        webmcp={webmcp}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
      />
      <DemoModeBanner />
      <ProductionStatus />

      {/*
        Layout: Agent swarm (left) | Workspace (center, big preview on
        top + tabbed panel below) | Creative Brief (right).
        On lg (1024–1279px) we drop the right rail so the preview
        has more room. On <lg, mobile tabs swap between the three.

        Per typography.md + highend.md the layout breathes generously
        and avoids generic 1px borders between panels (those read as a
        template, not a designed product). Each panel owns its own
        bezel shell from inside.
      */}
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-[228px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)_328px]">
        <aside
          className={
            "min-h-0 overflow-hidden rounded-2xl bg-muted " +
            (mobileView === "agents" ? "flex" : "hidden") + " lg:flex"
          }
        >
          <AgentList />
        </aside>

        <section
          className={
            "flex min-h-0 min-w-0 flex-col overflow-hidden " +
            (mobileView === "workspace" ? "flex" : "hidden") + " lg:flex"
          }
        >
          <Workspace />
        </section>

        <aside
          className={
            "min-h-0 overflow-hidden rounded-2xl bezel-shell " +
            (mobileView === "brief" ? "flex" : "hidden") + " xl:flex xl:flex-col"
          }
        >
          <BriefPanel />
        </aside>
      </div>

      <BottomBar />

      <DebugPanel />
      <ApprovalModal />
    </main>
  );
}
