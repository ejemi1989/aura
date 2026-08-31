-- AURA — cache-key materialized column + covering index
-- -----------------------------------------------------------------------------
-- Run AFTER 20260830_aura_init.sql.
--
-- The cache lookup (`findCachedArtifact` in src/lib/supabase/writers.ts)
-- filters by `(project_id, metadata->>cache_key)` and selects
-- (id, storage_key, mime_type, metadata). Today the GIN index on
-- metadata handles the jsonb lookup but can't be used for an
-- index-only scan, so every cache hit pays a heap fetch.
--
-- This migration:
--   1. Adds a generated column `cache_key text generated always as
--      (metadata->>'cache_key') stored`. Postgres materializes it,
--      so it's effectively free to read.
--   2. Adds a btree index `(project_id, cache_key)` so the lookup is
--      a single index-only scan.
--   3. Adds a covering INCLUDE so storage_key/mime_type come from the
--      index without a heap fetch.

begin;

-- Generated columns over jsonb are a 12+ feature; safe on Supabase
-- Postgres 15+. The column is STORED (not VIRTUAL) so it can be
-- indexed cheaply.
alter table public.artifacts
  add column if not exists cache_key text
  generated always as ((metadata ->> 'cache_key')) stored;

-- Covering index: lookup by (project_id, cache_key), INCLUDE the
-- columns we read back. Most-recent hit is ordered by created_at; in
-- the common case (one hit per scene) the index is small enough that
-- the ORDER BY is just a sort over the index slice.
create index if not exists idx_artifacts_project_cache_key
  on public.artifacts (project_id, cache_key)
  include (storage_key, mime_type, id);

commit;

-- Verifies with:
--   explain analyze
--   select id, storage_key, mime_type from artifacts
--   where project_id = 1 and cache_key = '...';
--   -- expect: Index Only Scan using idx_artifacts_project_cache_key
