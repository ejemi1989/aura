// Supabase writers for AURA's durable production state.
//
// All functions here are best-effort: they call into Supabase via the
// service-role client and swallow failures with a single console.warn.
// The studio continues to work in local-only mode when Supabase env
// vars are missing or the network is down; the warn makes it visible
// why persisted state isn't appearing in the database.
//
// Each function mirrors the shape of the corresponding WebMCP tool and
// the spec's §32 schema. Project IDs are auto-incrementing bigint in
// Postgres, so callers pass the *natural* project name/id; the helper
// resolves it to a row id via name lookup (and inserts the project row
// if missing).

import { trySupabaseServiceClient } from "./server";

export interface ProjectRow {
  id?: number;
  name: string;
  prompt: string;
  status?: string;
}

export interface SceneRow {
  id?: number;
  projectId: number;
  sceneNumber: number;
  prompt: string;
  status?: string;
  duration?: number;
}

export interface AgentRow {
  id?: number;
  projectId: number;
  role: string;
  status?: string;
  currentAction?: string | null;
}

export interface ArtifactRow {
  projectId: number;
  sceneId?: number | null;
  type: "image" | "video" | "audio" | "caption" | "final_video" | "script" | "storyboard";
  storageKey: string;
  mimeType?: string;
  provider?: string;
  status?: "requested" | "generating" | "generated" | "uploading" | "stored" | "available" | "failed" | "fallback";
  metadata?: Record<string, unknown>;
}

export interface GenerationJobRow {
  projectId: number;
  sceneId?: number | null;
  toolName: string;
  provider: string;
  externalJobId?: string | null;
  status: "queued" | "submitted" | "processing" | "downloading" | "uploading" | "complete" | "failed" | "fallback";
  error?: string | null;
}

export interface HumanDecisionRow {
  projectId: number;
  sceneId?: number | null;
  decision: "approve" | "reject";
  instruction?: string | null;
}

export interface ToolRunRow {
  projectId: number;
  sceneId?: number | null;
  toolName: string;
  agent: string;
  status?: "running" | "success" | "error" | "rejected" | "timeout";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
}

const AGENT_ROLES = [
  "creative-director",
  "brand-strategist",
  "scriptwriter",
  "copywriter",
  "graphic-designer",
  "motion-graphics",
  "voiceover",
  "video-editor",
  "critic-qa",
  "project-manager",
] as const;

/**
 * Idempotent project upsert. Returns the bigint id. Inserts with status
 * 'planning' if missing; otherwise updates status if a transition is
 * requested.
 */
export async function upsertProject(row: ProjectRow): Promise<number | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data: existing } = await supa
      .from("projects")
      .select("id")
      .eq("name", row.name)
      .maybeSingle();
    if (existing?.id) {
      if (row.status) {
        await supa
          .from("projects")
          .update({ status: row.status, prompt: row.prompt })
          .eq("id", existing.id);
      }
      return existing.id as number;
    }
    const { data, error } = await supa
      .from("projects")
      .insert({ name: row.name, prompt: row.prompt, status: row.status ?? "planning" })
      .select("id")
      .single();
    if (error || !data) return null;
    // Initialize the 10 agent rows so the control room has a complete
    // status view from the start.
    await supa
      .from("agents")
      .insert(
        AGENT_ROLES.map((role) => ({
          project_id: data.id,
          role,
          status: role === "creative-director" ? "planning" : "idle",
        })),
      );
    return data.id as number;
  } catch (err) {
    console.warn("[supabase] upsertProject failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function upsertScene(row: SceneRow): Promise<number | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data: existing } = await supa
      .from("scenes")
      .select("id")
      .eq("project_id", row.projectId)
      .eq("scene_number", row.sceneNumber)
      .maybeSingle();
    if (existing?.id) {
      await supa
        .from("scenes")
        .update({
          prompt: row.prompt,
          status: row.status ?? "pending",
          duration: row.duration ?? 4,
        })
        .eq("id", existing.id);
      return existing.id as number;
    }
    const { data, error } = await supa
      .from("scenes")
      .insert({
        project_id: row.projectId,
        scene_number: row.sceneNumber,
        prompt: row.prompt,
        status: row.status ?? "pending",
        duration: row.duration ?? 4,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as number;
  } catch (err) {
    console.warn("[supabase] upsertScene failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setAgentStatus(
  projectId: number,
  role: string,
  status: string,
  currentAction?: string | null
): Promise<void> {
  const supa = trySupabaseServiceClient();
  if (!supa) return;
  try {
    await supa
      .from("agents")
      .update({ status, current_action: currentAction ?? null })
      .eq("project_id", projectId)
      .eq("role", role);
  } catch (err) {
    console.warn("[supabase] setAgentStatus failed:", err instanceof Error ? err.message : err);
  }
}

export async function recordArtifact(row: ArtifactRow): Promise<number | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("artifacts")
      .insert({
        project_id: row.projectId,
        scene_id: row.sceneId ?? null,
        type: row.type,
        storage_key: row.storageKey,
        mime_type: row.mimeType ?? "application/octet-stream",
        provider: row.provider ?? "openai",
        status: row.status ?? "available",
        metadata: row.metadata ?? {},
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as number;
  } catch (err) {
    console.warn("[supabase] recordArtifact failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Cache lookup: hash of (project, scene, prompt, model, ...) — see spec §13. */
export async function findCachedArtifact(
  projectId: number,
  cacheKey: string
): Promise<{ id: number; storage_key: string; mime_type: string; metadata: unknown } | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    // Uses the generated `cache_key` column added in
    // 20260830_aura_cache_key.sql — indexed with (project_id, cache_key)
    // and INCLUDE (storage_key, mime_type, id) for an index-only scan.
    const { data, error } = await supa
      .from("artifacts")
      .select("id,storage_key,mime_type,metadata")
      .eq("project_id", projectId)
      .eq("cache_key", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: number; storage_key: string; mime_type: string; metadata: unknown };
  } catch (err) {
    console.warn("[supabase] findCachedArtifact failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Global content-cache lookup by cache key alone — no project scoping.
 *
 * The cache key is a hash of the *generation inputs* only (tool + prompt +
 * size + model + voice + source artifact), so the same asset is reused across
 * campaigns, scenes, and users. Tools call this BEFORE hitting a paid API: a
 * hit returns the already-generated public URL for free; only a miss calls
 * the provider.
 *
 * Best-effort — returns null on any error so a lookup failure falls through
 * to a normal (paid) generation rather than breaking the pipeline.
 */
export async function findCachedArtifactByKey(cacheKey: string): Promise<{
  id: number;
  storage_key: string;
  mime_type: string;
  metadata: unknown;
} | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("artifacts")
      .select("id,storage_key,mime_type,metadata")
      .eq("cache_key", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: number; storage_key: string; mime_type: string; metadata: unknown };
  } catch (err) {
    console.warn("[supabase] findCachedArtifactByKey failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function recordGenerationJob(row: GenerationJobRow): Promise<number | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("generation_jobs")
      .insert({
        project_id: row.projectId,
        scene_id: row.sceneId ?? null,
        tool_name: row.toolName,
        provider: row.provider,
        external_job_id: row.externalJobId ?? null,
        status: row.status,
        error: row.error ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as number;
  } catch (err) {
    console.warn("[supabase] recordGenerationJob failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function updateGenerationJob(
  id: number,
  patch: Partial<GenerationJobRow> & { error?: string | null }
): Promise<void> {
  const supa = trySupabaseServiceClient();
  if (!supa) return;
  try {
    await supa.from("generation_jobs").update(patch).eq("id", id);
  } catch (err) {
    console.warn("[supabase] updateGenerationJob failed:", err instanceof Error ? err.message : err);
  }
}

export async function recordHumanDecision(row: HumanDecisionRow): Promise<number | null> {
  const supa = trySupabaseServiceClient();
  if (!supa) return null;
  try {
    const { data, error } = await supa
      .from("human_decisions")
      .insert({
        project_id: row.projectId,
        scene_id: row.sceneId ?? null,
        decision: row.decision,
        instruction: row.instruction ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as number;
  } catch (err) {
    console.warn("[supabase] recordHumanDecision failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function recordToolRun(row: ToolRunRow): Promise<void> {
  const supa = trySupabaseServiceClient();
  if (!supa) return;
  try {
    await supa.from("tool_runs").insert({
      project_id: row.projectId,
      scene_id: row.sceneId ?? null,
      tool_name: row.toolName,
      agent: row.agent,
      status: row.status ?? "success",
      input: row.input ?? {},
      output: row.output ?? {},
      error: row.error ?? null,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[supabase] recordToolRun failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * One-shot helper for a generated artifact. Computes the cache key,
 * looks it up, generates + persists if missing, and writes the artifact
 * row. Returns `{ url, artifactId, cacheHit }`.
 */
export interface ArtifactWriteResult {
  url: string;
  artifactId: number | null;
  cacheHit: boolean;
  storageKey: string;
}

export async function persistArtifactWithMetadata(
  row: ArtifactRow & { storageKey: string; cacheKey: string }
): Promise<ArtifactWriteResult | null> {
  const cached = await findCachedArtifact(row.projectId, row.cacheKey);
  if (cached) {
    return {
      url: r2PublicUrlFor(cached.storage_key),
      artifactId: cached.id,
      cacheHit: true,
      storageKey: cached.storage_key,
    };
  }
  const id = await recordArtifact({
    ...row,
    metadata: { ...(row.metadata ?? {}), cache_key: row.cacheKey },
  });
  return {
    url: r2PublicUrlFor(row.storageKey),
    artifactId: id,
    cacheHit: false,
    storageKey: row.storageKey,
  };
}

export function r2PublicUrlFor(storageKey: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (base) return `${base}/${storageKey}`;
  // Without a public URL we still return a public-looking path so the
  // browser doesn't break; the actual signed-URL flow is wired in
  // r2AssetStore.ts. The control room will get a 401 until the route
  // returns a presigned URL, but the storage_key is the durable handle.
  return `/r2/${storageKey}`;
}
