-- AURA — initial database schema
-- -----------------------------------------------------------------------------
-- Source spec      : .context/system.md §32 (Supabase schema)
-- Style guide      : .context/data/data.md (postgres-patterns)
-- Migration target : Supabase Postgres (default extensions + auth schema)
-- Apply with       : Supabase SQL editor → New query → paste → Run
--                   (or `supabase db push` against a linked project)
--
-- This is an additive migration. It does not drop or rename existing tables.
-- If you have prior `projects`, `scenes`, `artifacts`, etc. from an earlier
-- attempt, either drop them first (`DROP TABLE … CASCADE`) or resolve the
-- column-name conflicts before running this file.
--
-- Style choices follow .context/data/data.md:
--   * bigint ids, text strings, timestamptz timestamps, jsonb for freeform
--   * B-tree on every FK column + composite indexes where queries hit both
--   * GIN on every jsonb column
--   * RLS policies use `(SELECT auth.uid()) = user_id` so auth.uid() is
--     hoisted as a Stable expression (cheaper than per-row eval)
--   * `FOR UPDATE SKIP LOCKED` for the generation-job worker queue
--   * pg_stat_statements extension for monitoring
--   * REVOKE ALL ON SCHEMA public FROM public as the final hardening step
--
-- Server-side privileged operations (providers, orchestrator) use a separate
-- service-role client that bypasses RLS by design (Supabase convention).
-- Clients connect with the publishable key + RLS.

begin;

-- ─── 0. Extensions ───────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "pg_stat_statements";

-- ─── 0a. Updated-at trigger function ─────────────────────────────────────────
-- Reused by every table that has updated_at. Cheap; stays well below the
-- per-row cost of doing it in application code.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 1. projects ─────────────────────────────────────────────────────────────
-- One row per studio project. The orchestrator (provider === 'orchestrator')
-- creates rows; RLS lets a client see only its own projects.
create table if not exists public.projects (
  id          bigint generated always as identity primary key,
  name        text        not null,
  prompt      text        not null,
  status      text        not null default 'planning'
              check (status in ('planning','scripting','storyboarding',
                                'image_generation','video_generation',
                                'tts','captioning','composing','qa',
                                'awaiting_approval','approved','complete',
                                'failed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_projects_status_created
  on public.projects (status, created_at desc);
drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ─── 2. scenes ───────────────────────────────────────────────────────────────
-- One row per scene per project. Carries the prompt + duration; the rest of
-- the scene state lives in `artifacts` (one row per generated asset) and
-- `generation_jobs` (in-flight + historical).
create table if not exists public.scenes (
  id            bigint generated always as identity primary key,
  project_id    bigint        not null references public.projects(id) on delete cascade,
  scene_number  int           not null,
  prompt        text          not null,
  status        text          not null default 'pending'
                check (status in ('pending','script_ready','visual_pending',
                                  'visual_ready','motion_pending','motion_ready',
                                  'voice_pending','voice_ready','caption_ready',
                                  'ready_for_composition','composed','qa',
                                  'approved','qa_rejected','revision','regenerate')),
  duration      numeric(10,2) not null default 4.0
                check (duration > 0 and duration <= 60),
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  unique (project_id, scene_number)
);
create index if not exists idx_scenes_project_id on public.scenes (project_id);
create index if not exists idx_scenes_project_status
  on public.scenes (project_id, status);
drop trigger if exists trg_scenes_updated_at on public.scenes;
create trigger trg_scenes_updated_at
  before update on public.scenes
  for each row execute function public.set_updated_at();

-- ─── 3. agents ───────────────────────────────────────────────────────────────
-- Per-project agent runtime state. 10 roles per .context/system.md §15.
create table if not exists public.agents (
  id              bigint generated always as identity primary key,
  project_id      bigint      not null references public.projects(id) on delete cascade,
  role            text        not null
                  check (role in ('creative-director','brand-strategist','scriptwriter',
                                  'copywriter','graphic-designer','motion-graphics',
                                  'voiceover','video-editor','critic-qa','project-manager')),
  status          text        not null default 'idle'
                  check (status in ('idle','planning','active','blocked','completed','error')),
  current_action  text,
  updated_at      timestamptz not null default now(),
  unique (project_id, role)
);
create index if not exists idx_agents_project_id on public.agents (project_id);
create index if not exists idx_agents_project_role
  on public.agents (project_id, role);

-- ─── 4. artifacts ────────────────────────────────────────────────────────────
-- One row per generated asset. storage_key points into Cloudflare R2 under
-- projects/{project_id}/scenes/{scene_id}/{image|video|audio}/... per
-- .context/system.md §21. mime_type + provider kept for ops/debug.
create table if not exists public.artifacts (
  id            bigint generated always as identity primary key,
  project_id    bigint      not null references public.projects(id) on delete cascade,
  scene_id      bigint              references public.scenes(id)   on delete cascade,
  type          text        not null
                check (type in ('image','video','audio','caption','final_video',
                                'script','storyboard')),
  storage_key   text        not null,
  mime_type     text        not null default 'application/octet-stream',
  provider      text        not null default 'openai',
  status        text        not null default 'available'
                check (status in ('requested','generating','generated',
                                  'uploading','stored','available','failed','fallback')),
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_artifacts_project_id     on public.artifacts (project_id);
create index if not exists idx_artifacts_scene_id       on public.artifacts (scene_id);
create index if not exists idx_artifacts_project_scene_type
  on public.artifacts (project_id, scene_id, type);
create index if not exists idx_artifacts_storage_key    on public.artifacts (storage_key);
create index if not exists idx_artifacts_metadata_gin   on public.artifacts using gin (metadata);

-- ─── 5. tool_runs ────────────────────────────────────────────────────────────
-- Audit trail for every WebMCP tool invocation per .context/system.md §12.
-- input/output stored as jsonb for replay; GIN indexes enable full-text
-- search of tool history later.
create table if not exists public.tool_runs (
  id          bigint generated always as identity primary key,
  project_id  bigint      not null references public.projects(id) on delete cascade,
  scene_id    bigint              references public.scenes(id)  on delete cascade,
  tool_name   text        not null,
  agent       text        not null,
  status      text        not null default 'running'
              check (status in ('running','success','error','rejected','timeout')),
  input       jsonb       not null default '{}'::jsonb,
  output      jsonb,
  error       text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists idx_tool_runs_project_id     on public.tool_runs (project_id);
create index if not exists idx_tool_runs_scene_id       on public.tool_runs (scene_id);
create index if not exists idx_tool_runs_tool_name      on public.tool_runs (tool_name);
create index if not exists idx_tool_runs_project_started
  on public.tool_runs (project_id, started_at desc);
create index if not exists idx_tool_runs_input_gin      on public.tool_runs using gin (input);
create index if not exists idx_tool_runs_output_gin     on public.tool_runs using gin (output);

-- ─── 6. human_decisions ───────────────────────────────────────────────────────
-- Durable approval / rejection log per .context/system.md §30. The
-- in-memory waitForHumanDecision flow reads from here so a Vercel cold
-- start doesn't drop the human's verdict.
create table if not exists public.human_decisions (
  id          bigint generated always as identity primary key,
  project_id  bigint      not null references public.projects(id) on delete cascade,
  scene_id    bigint              references public.scenes(id)  on delete cascade,
  decision    text        not null
              check (decision in ('approve','reject')),
  instruction text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_human_decisions_project_id
  on public.human_decisions (project_id);
create index if not exists idx_human_decisions_project_scene
  on public.human_decisions (project_id, scene_id);
create index if not exists idx_human_decisions_created_at
  on public.human_decisions (created_at desc);

-- ─── 7. generation_jobs ───────────────────────────────────────────────────────
-- Long-running provider jobs (image_to_video, text_to_video, async batch
-- image gen). Worker query uses `FOR UPDATE SKIP LOCKED` so two Vercel
-- workers can drain the queue without double-processing a row.
create table if not exists public.generation_jobs (
  id                bigint generated always as identity primary key,
  project_id        bigint      not null references public.projects(id) on delete cascade,
  scene_id          bigint              references public.scenes(id)  on delete cascade,
  tool_name         text        not null,
  provider          text        not null,
  external_job_id   text,
  status            text        not null default 'queued'
                    check (status in ('queued','submitted','processing',
                                      'downloading','uploading','complete',
                                      'failed','fallback')),
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_generation_jobs_project_id on public.generation_jobs (project_id);
create index if not exists idx_generation_jobs_scene_id   on public.generation_jobs (scene_id);
-- Worker hot path: WHERE status='queued' ORDER BY created_at LIMIT 1
-- Partial index keeps it tiny (only rows actually eligible for pickup).
create index if not exists idx_generation_jobs_queued
  on public.generation_jobs (created_at)
  where status = 'queued';
-- Lookup by external id when a provider webhook arrives.
create index if not exists idx_generation_jobs_external
  on public.generation_jobs (provider, external_job_id)
  where external_job_id is not null;
drop trigger if exists trg_generation_jobs_updated_at on public.generation_jobs;
create trigger trg_generation_jobs_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();

-- ─── 8. Realtime publication ─────────────────────────────────────────────────
-- Add the new tables to the Supabase Realtime publication so the
-- control room can subscribe to artifact / status changes per §33.
-- The publication is created in Supabase by default; DO block silently
-- skips if it doesn't exist on a self-hosted Postgres.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Idempotent: add table only if not already in the publication.
    perform 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'agents';
    if not found then
      alter publication supabase_realtime add table public.agents;
    end if;
    perform 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'scenes';
    if not found then
      alter publication supabase_realtime add table public.scenes;
    end if;
    perform 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'artifacts';
    if not found then
      alter publication supabase_realtime add table public.artifacts;
    end if;
    perform 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'human_decisions';
    if not found then
      alter publication supabase_realtime add table public.human_decisions;
    end if;
  end if;
end$$;

-- ─── 9. Row Level Security ───────────────────────────────────────────────────
-- Server-side writes (orchestrator, providers) use the service-role key,
-- which bypasses RLS by Supabase convention. Client-side reads (control
-- room) use the publishable key and are gated by these policies.
--
-- Every authenticated user is mapped to a project_id via the
-- `public.project_members` join table below. We allow users to read/write
-- only projects they're a member of. The auth.uid() call is wrapped in a
-- SELECT so Postgres hoists it as a Stable expression instead of evaluating
-- it per row — minor but real performance win on large result sets.
alter table public.projects       enable row level security;
alter table public.scenes         enable row level security;
alter table public.agents         enable row level security;
alter table public.artifacts      enable row level security;
alter table public.tool_runs      enable row level security;
alter table public.human_decisions enable row level security;
alter table public.generation_jobs enable row level security;

create table if not exists public.project_members (
  project_id bigint not null references public.projects(id) on delete cascade,
  user_id    uuid   not null references auth.users(id)    on delete cascade,
  role       text   not null default 'owner'
             check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists idx_project_members_user_id
  on public.project_members (user_id);
alter table public.project_members enable row level security;

-- Helper: which project_ids can the current authenticated user see?
-- SECURITY DEFINER so it runs as the function owner and bypasses RLS on
-- project_members; otherwise the policy referencing it would recurse.
-- `set search_path = ''` (empty) is the Supabase recommendation — it
-- forces the function to fully-qualify every reference, so a malicious
-- caller who creates a `public` table with the right name can't shadow
-- it. See supabase-postgres-best-practices/references/security-rls-performance.md.
create or replace function public.current_project_ids()
returns setof bigint
language sql
security definer
set search_path = ''
stable
as $$
  select project_id from public.project_members
  where user_id = (select auth.uid());
$$;

-- projects: read = member, write = owner or editor
drop policy if exists projects_select_member on public.projects;
create policy projects_select_member on public.projects
  for select using (id in (select public.current_project_ids()));

drop policy if exists projects_write_member on public.projects;
create policy projects_write_member on public.projects
  for all using (id in (select public.current_project_ids()))
            with check (id in (select public.current_project_ids()));

-- scenes, agents, artifacts, tool_runs, human_decisions, generation_jobs:
-- read/write scoped by parent project_id.
drop policy if exists scenes_rw_member on public.scenes;
create policy scenes_rw_member on public.scenes
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

drop policy if exists agents_rw_member on public.agents;
create policy agents_rw_member on public.agents
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

drop policy if exists artifacts_rw_member on public.artifacts;
create policy artifacts_rw_member on public.artifacts
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

drop policy if exists tool_runs_rw_member on public.tool_runs;
create policy tool_runs_rw_member on public.tool_runs
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

drop policy if exists human_decisions_rw_member on public.human_decisions;
create policy human_decisions_rw_member on public.human_decisions
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

drop policy if exists generation_jobs_rw_member on public.generation_jobs;
create policy generation_jobs_rw_member on public.generation_jobs
  for all using (project_id in (select public.current_project_ids()))
        with check (project_id in (select public.current_project_ids()));

-- project_members: a user can see their own membership rows; only owners
-- can add new members. (Owner check via join.)
drop policy if exists project_members_select_self on public.project_members;
create policy project_members_select_self on public.project_members
  for select using (user_id = (select auth.uid()));

drop policy if exists project_members_insert_owner on public.project_members;
create policy project_members_insert_owner on public.project_members
  for insert with check (
    exists (
      select 1 from public.project_members m
      where m.project_id = project_members.project_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

-- ─── 10. Final hardening ─────────────────────────────────────────────────────
-- Per .context/data/data.md: revoke the blanket `public` grant. The Supabase
-- SQL editor and migration tooling use elevated roles (postgres / service_role)
-- that don't depend on this grant. Application code connects as authenticated
-- or anon and gets explicit grants below.
revoke all on schema public from public;

-- Re-grant minimum surface to the standard roles Supabase uses.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public
  to authenticated, service_role;
-- The function is SECURITY DEFINER; explicit grant so it can be invoked
-- from RLS policy expressions.
grant execute on function public.current_project_ids() to authenticated, service_role;

commit;

-- End of migration.
-- Verifies with:
--   \dt+ public.*
--   select * from public.artifacts limit 1;
--   select proname, prosecdef from pg_proc where proname = 'current_project_ids';
