"use client";

import { create } from "zustand";
import type {
  AgentActivityEvent,
  AgentId,
  AgentStatus,
  PendingApproval,
  Project,
  RevisionRequest,
  Scene,
  ToolCallLogEntry,
  ToolCallStatus,
} from "@/types";

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyProject(): Project {
  const now = Date.now();
  return {
    id: newId("proj"),
    name: "Untitled Campaign",
    phase: "not_started",
    scenes: [],
    captions: [],
    qaNotes: [],
    qaVerdict: null,
    createdAt: now,
    updatedAt: now,
  };
}

interface StudioState {
  project: Project;
  agentStatus: Record<AgentId, AgentStatus>;
  activity: AgentActivityEvent[];
  toolCalls: ToolCallLogEntry[];
  pendingApprovals: PendingApproval[];
  revisionRequest: RevisionRequest | null;
  directorPlan: string[];
  directorLog: { role: "human" | "director"; text: string; ts: number }[];

  // True while the in-app Creative Director orchestrator is driving the
  // store directly. The external WebMCP agent sync is suppressed during an
  // in-app run so the two never fight over the same slice of state.
  isDirecting: boolean;

  // Interactive editing state — drives the Premiere-style timeline and
  // inspector. The Director's tools only write to project/agent state;
  // selection and playhead are UI concerns that live here so the
  // timeline, monitor, and inspector stay in sync.
  selectedSceneId: string | null;
  playheadSeconds: number;
  timelineZoom: number; // pixels per second
  isPlaying: boolean;

  // project mutators, called from inside tool `execute` functions
  setProjectMeta: (patch: Partial<Project>) => void;
  setScenes: (scenes: Scene[]) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  addCaption: (caption: string) => void;
  setPhase: (phase: Project["phase"]) => void;
  resetProject: () => void;
  // Read-only getters used by readOnlyHint tools. We expose them as
  // methods so tools don't have to subscribe to the whole store.
  getProject: () => Project;
  getPendingApprovals: () => PendingApproval[];

  // interactive mutators
  selectScene: (id: string | null) => void;
  setPlayhead: (seconds: number) => void;
  setTimelineZoom: (px: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // agent + activity
  setAgentStatus: (agentId: AgentId, status: AgentStatus, message?: string) => void;
  logActivity: (agentId: AgentId, status: AgentStatus, message: string) => void;

  // tool call debug log
  startToolCall: (entry: Omit<ToolCallLogEntry, "startedAt" | "status">) => string;
  finishToolCall: (id: string, patch: Partial<ToolCallLogEntry>) => void;

  // human approval / veto
  requestApproval: (approval: Omit<PendingApproval, "id" | "createdAt">) => string;
  resolveApproval: (id: string, approved: boolean) => void;

  // mid-run veto: request a scene remake the running Director picks up
  requestRevision: (req: Omit<RevisionRequest, "status" | "createdAt">) => void;
  clearRevision: () => void;

  // director chat
  pushDirectorMessage: (role: "human" | "director", text: string) => void;
  setDirectorPlan: (plan: string[]) => void;

  // orchestration flag + external-agent hydration
  setDirecting: (directing: boolean) => void;
  hydrateFrom: (snap: {
    project: Project;
    agentStatus: Record<AgentId, AgentStatus>;
    activity: AgentActivityEvent[];
    pendingApprovals: PendingApproval[];
    toolCalls?: ToolCallLogEntry[];
  }) => void;
}

export const useStudioStore = create<StudioState>()(
  (set, get) => ({
      project: emptyProject(),
      agentStatus: {
        "creative-director": "idle",
        "brand-strategist": "idle",
        scriptwriter: "idle",
        copywriter: "idle",
        "graphic-designer": "idle",
        "motion-graphics": "idle",
        voiceover: "idle",
        "video-editor": "idle",
        "critic-qa": "idle",
        "project-manager": "idle",
      },
      activity: [],
      toolCalls: [],
      pendingApprovals: [],
      revisionRequest: null,
      directorPlan: [],
      directorLog: [],
      isDirecting: false,

      selectedSceneId: null,
      playheadSeconds: 0,
      timelineZoom: 24, // pixels per second — comfortable default
      isPlaying: false,

      setProjectMeta: (patch) =>
        set((s) => ({ project: { ...s.project, ...patch, updatedAt: Date.now() } })),

      setScenes: (scenes) =>
        set((s) => ({ project: { ...s.project, scenes, updatedAt: Date.now() } })),

      updateScene: (id, patch) =>
        set((s) => ({
          project: {
            ...s.project,
            scenes: s.project.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
            updatedAt: Date.now(),
          },
        })),

      addCaption: (caption) =>
        set((s) => ({
          project: { ...s.project, captions: [...s.project.captions, caption], updatedAt: Date.now() },
        })),

      setPhase: (phase) =>
        set((s) => ({ project: { ...s.project, phase, updatedAt: Date.now() } })),

      // Read-only accessors for readOnlyHint tools. Returning snapshots
      // (not refs) so the tool result doesn't change underneath the caller.
      getProject: () => get().project,
      getPendingApprovals: () => get().pendingApprovals,

      // Interactive editing mutators
      selectScene: (id) => set({ selectedSceneId: id }),
      setPlayhead: (seconds) => set({ playheadSeconds: Math.max(0, seconds) }),
      setTimelineZoom: (px) => set({ timelineZoom: Math.max(8, Math.min(120, px)) }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),

      resetProject: () =>
        set(() => ({
          project: emptyProject(),
          activity: [],
          toolCalls: [],
          pendingApprovals: [],
          revisionRequest: null,
          selectedSceneId: null,
          playheadSeconds: 0,
          isPlaying: false,
          agentStatus: {
            "creative-director": "idle",
            "brand-strategist": "idle",
            scriptwriter: "idle",
            copywriter: "idle",
            "graphic-designer": "idle",
            "motion-graphics": "idle",
            voiceover: "idle",
            "video-editor": "idle",
            "critic-qa": "idle",
            "project-manager": "idle",
          },
        })),

      setAgentStatus: (agentId, status, message) => {
        set((s) => ({ agentStatus: { ...s.agentStatus, [agentId]: status } }));
        if (message) get().logActivity(agentId, status, message);
      },

      logActivity: (agentId, status, message) =>
        set((s) => ({
          activity: [
            ...s.activity,
            { id: newId("act"), agentId, status, message, timestamp: Date.now() },
          ].slice(-200),
        })),

      startToolCall: (entry) => {
        const id = entry.id ?? newId("call");
        const newEntry: ToolCallLogEntry = { ...entry, id, status: "pending", startedAt: Date.now() };
        set((s) => ({
          toolCalls: [...s.toolCalls, newEntry].slice(-300),
        }));
        return id;
      },

      finishToolCall: (id, patch) =>
        set((s) => ({
          toolCalls: s.toolCalls.map((c) =>
            c.id === id ? { ...c, ...patch, finishedAt: Date.now() } : c
          ),
        })),

      requestApproval: (approval) => {
        const id = newId("appr");
        set((s) => ({
          pendingApprovals: [...s.pendingApprovals, { ...approval, id, createdAt: Date.now() }],
        }));
        return id;
      },

      resolveApproval: (id, _approved) =>
        set((s) => ({ pendingApprovals: s.pendingApprovals.filter((a) => a.id !== id) })),

      requestRevision: (req) => {
        // If the human asks for a scene that's already mid-refinement, keep the
        // newest request (the latest intent wins). The Director consumes this at
        // its next checkpoint and flips it to "applied".
        set((s) => ({
          revisionRequest: {
            ...req,
            status: "requested",
            createdAt: Date.now(),
          },
        }));
      },

      clearRevision: () => set({ revisionRequest: null }),

      pushDirectorMessage: (role, text) =>
        set((s) => ({ directorLog: [...s.directorLog, { role, text, ts: Date.now() }] })),

      setDirectorPlan: (plan) => set({ directorPlan: plan }),

      setDirecting: (directing) => set({ isDirecting: directing }),

      // Bulk-apply the server-side WebMCP agent snapshot into the client store a
      // the UI renders. Only the server-visible slices are replaced; UI-only
      // state (selection, playhead, zoom, director chat/plan, tool-call log) is
      // left untouched so an external run doesn't nuke the judge's cursor.
      hydrateFrom: (snap) =>
        set((s) => ({
          project: snap.project,
          agentStatus: snap.agentStatus,
          // Server activity events have no `id`; the feed needs one for a React
          // key. Derive a stable unique key so external runs don't trip the
          // "missing key" warning that surfaced in LiveActivityFeed.
          activity: snap.activity.map((a, i) => ({
            ...a,
            id: a.id ?? `ext_${a.agentId}_${a.timestamp}_${i}`,
          })),
          pendingApprovals: snap.pendingApprovals.map((a) => ({ ...a, server: true })),
          // Merge the server's tool-call log into the client's log so the
          // Debug Panel shows external-agent calls (orange) with their
          // provider + cost + latency. We merge by id and keep the client's
          // own entries intact.
          toolCalls: snap.toolCalls
            ? (() => {
                const have = new Set(s.toolCalls.map((c) => c.id));
                const merged = [...s.toolCalls];
                for (const c of snap.toolCalls!) {
                  if (!have.has(c.id)) merged.push(c as ToolCallLogEntry);
                }
                return merged.slice(-300);
              })()
            : s.toolCalls,
          revisionRequest: null,
          ...(snap.project.id !== s.project.id ? { selectedSceneId: null, playheadSeconds: 0 } : {}),
        })),
  })
);
