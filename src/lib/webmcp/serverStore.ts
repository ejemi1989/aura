// Server-side studio state for the /api/webmcp/* endpoints.
//
// Persists to a JSON file on disk so state survives across separate HTTP
// requests — each curl call hits a fresh Node process on cold dev
// serverless, and even on a long-running server we want restarts to keep
// the in-flight project alive.
//
// For multi-tenant production, replace this with a Postgres/Redis-backed
// store keyed by project id. The shape of Project/Scene/AgentStatus
// mirrors src/types/index.ts; keep them in lockstep.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { AgentId, AgentStatus, Project, Scene, ToolCallLogEntry } from "@/types";

type AgentState = Record<AgentId, AgentStatus>;

export interface ServerToolCallEntry {
  id: string;
  toolName: string;
  agentId: AgentId | "human" | "external-agent";
  origin: "in-app-director" | "human" | "external-agent" | "browser-agent";
  input: unknown;
  output?: unknown;
  status: "pending" | "success" | "error" | "awaiting_approval" | "rejected";
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string;
  provider?: string;
  costUsd?: number;
  latencyMs?: number;
}

interface PersistedState {
  project: Project;
  agentStatus: AgentState;
  activity: { agentId: AgentId; status: AgentStatus; message: string; timestamp: number }[];
  pendingApprovals: { id: string; requestedBy: AgentId; summary: string; detail: string; createdAt: number }[];
  /** Recent tool calls made by external agents (HTTP path). Used so the
   *  studio UI's Debug Panel can show what an external agent did, with
   *  provider + cost + latency, colour-coded as an external call. */
  toolCalls: ServerToolCallEntry[];
}

const STATE_PATH = join(process.cwd(), ".studio-state.json");

function freshProject(): Project {
  const now = Date.now();
  return {
    id: `proj_${Math.random().toString(36).slice(2, 10)}`,
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

function emptyStatus(): AgentState {
  return {
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
  };
}

function freshState(): PersistedState {
  return {
    project: freshProject(),
    agentStatus: emptyStatus(),
    activity: [],
    pendingApprovals: [],
    toolCalls: [],
  };
}

let memoryState: PersistedState | null = null;
let loadPromise: Promise<PersistedState> | null = null;

async function loadState(): Promise<PersistedState> {
  if (memoryState) return memoryState;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const buf = await fs.readFile(STATE_PATH, "utf-8");
      memoryState = JSON.parse(buf) as PersistedState;
    } catch {
      memoryState = freshState();
    }
    return memoryState!;
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  if (!memoryState) return;
  try {
    await fs.writeFile(STATE_PATH, JSON.stringify(memoryState, null, 2));
  } catch {
    // Best-effort. On read-only file systems the in-memory copy is still
    // valid for the current process lifetime.
  }
}

export const serverStore = {
  async getProject(): Promise<Project> {
    const s = await loadState();
    return { ...s.project, scenes: s.project.scenes.map((sc) => ({ ...sc })) };
  },
  async getAgentStatus(): Promise<AgentState> {
    const s = await loadState();
    return { ...s.agentStatus };
  },
  async getActivity() {
    const s = await loadState();
    return [...s.activity];
  },
  async getPendingApprovals() {
    const s = await loadState();
    return [...s.pendingApprovals];
  },
  async reset(): Promise<void> {
    memoryState = freshState();
    await persist();
  },
  async setProjectMeta(patch: Partial<Project>): Promise<void> {
    const s = await loadState();
    s.project = { ...s.project, ...patch, updatedAt: Date.now() };
    await persist();
  },
  async setScenes(scenes: Scene[]): Promise<void> {
    const s = await loadState();
    s.project = { ...s.project, scenes, updatedAt: Date.now() };
    await persist();
  },
  async updateScene(id: string, patch: Partial<Scene>): Promise<void> {
    const s = await loadState();
    s.project = {
      ...s.project,
      scenes: s.project.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
      updatedAt: Date.now(),
    };
    await persist();
  },
  async addCaption(c: string): Promise<void> {
    const s = await loadState();
    s.project = { ...s.project, captions: [...s.project.captions, c], updatedAt: Date.now() };
    await persist();
  },
  async setPhase(phase: Project["phase"]): Promise<void> {
    const s = await loadState();
    s.project = { ...s.project, phase, updatedAt: Date.now() };
    await persist();
  },
  async setAgentStatus(agentId: AgentId, status: AgentStatus, message?: string): Promise<void> {
    const s = await loadState();
    s.agentStatus = { ...s.agentStatus, [agentId]: status };
    if (message) {
      s.activity = [
        ...s.activity,
        { agentId, status, message, timestamp: Date.now() },
      ].slice(-200);
    }
    await persist();
  },
  async logActivity(agentId: AgentId, status: AgentStatus, message: string): Promise<void> {
    const s = await loadState();
    s.activity = [
      ...s.activity,
      { agentId, status, message, timestamp: Date.now() },
    ].slice(-200);
    await persist();
  },
  async requestApproval(input: { requestedBy: AgentId; summary: string; detail: string }): Promise<string> {
    const s = await loadState();
    const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    s.pendingApprovals = [...s.pendingApprovals, { ...input, id, createdAt: Date.now() }];
    await persist();
    return id;
  },
  async resolveApproval(id: string): Promise<void> {
    const s = await loadState();
    s.pendingApprovals = s.pendingApprovals.filter((a) => a.id !== id);
    await persist();
  },
  async findScene(id: string): Promise<Scene | undefined> {
    const s = await loadState();
    return s.project.scenes.find((sc) => sc.id === id);
  },
  async getToolCalls(): Promise<ServerToolCallEntry[]> {
    const s = await loadState();
    return [...s.toolCalls];
  },
  /** Append a finished tool call to the server-side log. The caller
   *  computes startedAt/finishedAt/latencyMs so we don't have to reach
   *  into call sites. We keep the last 200 entries (same window as the
   *  client store). */
  async logToolCall(entry: ServerToolCallEntry): Promise<void> {
    const s = await loadState();
    s.toolCalls = [...s.toolCalls, entry].slice(-200);
    await persist();
  },
};

/** Reset to a clean state — used by tests and by /api/webmcp/reset. */
export async function resetServerStore(): Promise<void> {
  await serverStore.reset();
}
