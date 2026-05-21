-- ============================================================
-- 20260519 - Harden row level security policies
-- ============================================================
-- Applies explicit owner-scoped policies to the current public schema.
-- Service-role and security-definer database functions continue to work
-- because this migration enables RLS but does not FORCE RLS.

-- ---------------------------------------------------------------------------
-- Enable RLS on every application table in the current schema.
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
alter table public.buildings enable row level security;
alter table public.density_cells enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.rate_limit_rules enable row level security;
alter table public.run_tags enable row level security;
alter table public.simulation_bottlenecks enable row level security;
alter table public.simulation_configs enable row level security;
alter table public.simulation_results enable row level security;
alter table public.simulation_runs enable row level security;
alter table public.simulation_zones enable row level security;

-- ---------------------------------------------------------------------------
-- Drop previous policies so the final state is easy to audit.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "Users can view own runs" on public.simulation_runs;
drop policy if exists "Users can insert own runs" on public.simulation_runs;
drop policy if exists "Users can update own runs" on public.simulation_runs;
drop policy if exists "Users can delete own runs" on public.simulation_runs;
drop policy if exists "simulation_runs_select_own" on public.simulation_runs;
drop policy if exists "simulation_runs_insert_own" on public.simulation_runs;
drop policy if exists "simulation_runs_update_own" on public.simulation_runs;

drop policy if exists "Users can view own configs" on public.simulation_configs;
drop policy if exists "Users can insert own configs" on public.simulation_configs;
drop policy if exists "Users can update own configs" on public.simulation_configs;
drop policy if exists "Users can delete own configs" on public.simulation_configs;
drop policy if exists "simulation_configs_select_own_run" on public.simulation_configs;
drop policy if exists "simulation_configs_insert_own_run" on public.simulation_configs;
drop policy if exists "simulation_configs_update_own_run" on public.simulation_configs;
drop policy if exists "simulation_configs_delete_own_run" on public.simulation_configs;

drop policy if exists "Users can view own results" on public.simulation_results;
drop policy if exists "Users can insert own results" on public.simulation_results;
drop policy if exists "Users can update own results" on public.simulation_results;
drop policy if exists "simulation_results_select_own_run" on public.simulation_results;
drop policy if exists "simulation_results_insert_own_run" on public.simulation_results;
drop policy if exists "simulation_results_update_own_run" on public.simulation_results;
drop policy if exists "simulation_results_delete_own_run" on public.simulation_results;

drop policy if exists "Users can view own zones" on public.simulation_zones;
drop policy if exists "Users can insert own zones" on public.simulation_zones;
drop policy if exists "Users can update own zones" on public.simulation_zones;
drop policy if exists "Users can delete own zones" on public.simulation_zones;
drop policy if exists "simulation_zones_select_own_run" on public.simulation_zones;
drop policy if exists "simulation_zones_insert_own_run" on public.simulation_zones;
drop policy if exists "simulation_zones_update_own_run" on public.simulation_zones;
drop policy if exists "simulation_zones_delete_own_run" on public.simulation_zones;

drop policy if exists "Users can view own bottlenecks" on public.simulation_bottlenecks;
drop policy if exists "Users can insert own bottlenecks" on public.simulation_bottlenecks;
drop policy if exists "Users can update own bottlenecks" on public.simulation_bottlenecks;
drop policy if exists "Users can delete own bottlenecks" on public.simulation_bottlenecks;
drop policy if exists "simulation_bottlenecks_select_own_run" on public.simulation_bottlenecks;
drop policy if exists "simulation_bottlenecks_insert_own_run" on public.simulation_bottlenecks;
drop policy if exists "simulation_bottlenecks_update_own_run" on public.simulation_bottlenecks;
drop policy if exists "simulation_bottlenecks_delete_own_run" on public.simulation_bottlenecks;

drop policy if exists "Users can view own density cells" on public.density_cells;
drop policy if exists "Users can insert own density cells" on public.density_cells;
drop policy if exists "Users can update own density cells" on public.density_cells;
drop policy if exists "Users can delete own density cells" on public.density_cells;
drop policy if exists "density_cells_select_own_run" on public.density_cells;
drop policy if exists "density_cells_insert_own_run" on public.density_cells;
drop policy if exists "density_cells_update_own_run" on public.density_cells;
drop policy if exists "density_cells_delete_own_run" on public.density_cells;

drop policy if exists "Users can view buildings" on public.buildings;
drop policy if exists "buildings_select_authenticated" on public.buildings;

drop policy if exists "Users can view run tags on own runs" on public.run_tags;
drop policy if exists "Users can insert tags on own runs" on public.run_tags;
drop policy if exists "Users can delete tags on own runs" on public.run_tags;
drop policy if exists "run_tags_select_own_run" on public.run_tags;
drop policy if exists "run_tags_insert_own_run" on public.run_tags;
drop policy if exists "run_tags_delete_own_run" on public.run_tags;

drop policy if exists "Users can view own audit logs" on public.audit_logs;
drop policy if exists "System can insert audit logs" on public.audit_logs;
drop policy if exists "Users can insert own audit logs" on public.audit_logs;
drop policy if exists "audit_logs_select_own" on public.audit_logs;
drop policy if exists "audit_logs_insert_own" on public.audit_logs;

drop policy if exists "Users can view own rate limit events" on public.rate_limit_events;
drop policy if exists "rate_limit_events_select_own" on public.rate_limit_events;

drop policy if exists "Authenticated users can view rate limit rules" on public.rate_limit_rules;
drop policy if exists "rate_limit_rules_select_authenticated" on public.rate_limit_rules;

-- ---------------------------------------------------------------------------
-- Profiles: users can read and maintain only their own profile row.
-- ---------------------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Simulation runs: users can read/create/update only their own runs.
-- Direct deletes remain unavailable to browser clients; existing RPCs handle
-- rate-limited delete/reset operations.
-- ---------------------------------------------------------------------------
create policy "simulation_runs_select_own"
  on public.simulation_runs for select
  to authenticated
  using (user_id = auth.uid());

create policy "simulation_runs_insert_own"
  on public.simulation_runs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "simulation_runs_update_own"
  on public.simulation_runs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Child simulation tables: access follows parent run ownership.
-- ---------------------------------------------------------------------------
create policy "simulation_configs_select_own_run"
  on public.simulation_configs for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_configs.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_configs_insert_own_run"
  on public.simulation_configs for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_configs.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_configs_update_own_run"
  on public.simulation_configs for update
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_configs.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_configs.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_configs_delete_own_run"
  on public.simulation_configs for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_configs.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_results_select_own_run"
  on public.simulation_results for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_results.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_results_insert_own_run"
  on public.simulation_results for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_results.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_results_update_own_run"
  on public.simulation_results for update
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_results.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_results.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_results_delete_own_run"
  on public.simulation_results for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_results.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_zones_select_own_run"
  on public.simulation_zones for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_zones.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_zones_insert_own_run"
  on public.simulation_zones for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_zones.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_zones_update_own_run"
  on public.simulation_zones for update
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_zones.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_zones.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_zones_delete_own_run"
  on public.simulation_zones for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_zones.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_bottlenecks_select_own_run"
  on public.simulation_bottlenecks for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_bottlenecks.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_bottlenecks_insert_own_run"
  on public.simulation_bottlenecks for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_bottlenecks.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_bottlenecks_update_own_run"
  on public.simulation_bottlenecks for update
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_bottlenecks.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_bottlenecks.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "simulation_bottlenecks_delete_own_run"
  on public.simulation_bottlenecks for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_bottlenecks.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "density_cells_select_own_run"
  on public.density_cells for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = density_cells.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "density_cells_insert_own_run"
  on public.density_cells for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = density_cells.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "density_cells_update_own_run"
  on public.density_cells for update
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = density_cells.run_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = density_cells.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "density_cells_delete_own_run"
  on public.density_cells for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = density_cells.run_id
        and r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Run tags: tags inherit run ownership.
-- ---------------------------------------------------------------------------
create policy "run_tags_select_own_run"
  on public.run_tags for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = run_tags.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "run_tags_insert_own_run"
  on public.run_tags for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = run_tags.run_id
        and r.user_id = auth.uid()
    )
  );

create policy "run_tags_delete_own_run"
  on public.run_tags for delete
  to authenticated
  using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = run_tags.run_id
        and r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Audit logs: browser clients can only see/write their own audit rows.
-- Null-user system rows stay hidden from normal users.
-- ---------------------------------------------------------------------------
create policy "audit_logs_select_own"
  on public.audit_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "audit_logs_insert_own"
  on public.audit_logs for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Rate limit internals.
-- Rules are read by security-definer functions only. Events are visible to
-- their owner for debugging/accountability, but writes stay function-owned.
-- ---------------------------------------------------------------------------
create policy "rate_limit_events_select_own"
  on public.rate_limit_events for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Buildings intentionally receive no browser policy. The app currently uses
-- hardcoded campus buildings, and direct table reads are not required.
-- ---------------------------------------------------------------------------
