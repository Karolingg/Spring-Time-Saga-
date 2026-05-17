-- ============================================================
-- EVACSIM — Normalized schema (5NF / 6NF approach)
-- ============================================================

-- 0. Clean slate — drop everything in reverse dependency order
--    so re-running this script is always safe.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();


drop table if exists public.density_cells cascade;
drop table if exists public.simulation_bottlenecks cascade;
drop table if exists public.simulation_zones cascade;
drop table if exists public.simulation_results cascade;
drop table if exists public.simulation_configs cascade;
drop table if exists public.simulation_runs cascade;
drop table if exists public.profiles cascade;

-- ============================================================
-- 1. PROFILES (auto-created from auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. SIMULATION_RUNS (core run record)
-- ============================================================
create table public.simulation_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  disaster_type  text not null check (disaster_type in ('fire', 'earthquake')),
  status         text not null default 'pending' check (status in ('pending', 'running', 'completed', 'stopped')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_simulation_runs_user_id on public.simulation_runs(user_id);

-- ============================================================
-- 3. SIMULATION_CONFIGS (immutable input params, 1:1 with runs)
-- ============================================================
create table public.simulation_configs (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null unique references public.simulation_runs(id) on delete cascade,
  agent_count  integer not null,
  grid_width   integer not null,
  grid_height  integer not null,
  exit_count   integer not null,
  wall_density numeric not null,
  speed_ms     integer not null
);

-- ============================================================
-- 4. SIMULATION_RESULTS (write-once output, 1:1 with runs)
-- ============================================================
create table public.simulation_results (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null unique references public.simulation_runs(id) on delete cascade,
  total_steps         integer not null,
  evacuated_count     integer not null,
  max_congestion      integer not null,
  evacuation_time     numeric not null,
  congestion_exposure numeric not null,
  global_peak_density numeric not null
);

-- ============================================================
-- 5. SIMULATION_ZONES (1:N per run)
-- ============================================================
create table public.simulation_zones (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.simulation_runs(id) on delete cascade,
  zone_name        text not null,
  intensity        numeric not null,
  agent_count      integer not null,
  bottleneck_count integer not null,
  risk_level       text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  lat              numeric,
  lng              numeric
);

create index idx_simulation_zones_run_id on public.simulation_zones(run_id);

-- ============================================================
-- 6. SIMULATION_BOTTLENECKS (1:N per run)
-- ============================================================
create table public.simulation_bottlenecks (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.simulation_runs(id) on delete cascade,
  zone_name   text not null,
  severity    text not null check (severity in ('LOW', 'MEDIUM', 'HIGH')),
  cell_x      integer,
  cell_y      integer,
  description text
);

create index idx_simulation_bottlenecks_run_id on public.simulation_bottlenecks(run_id);

-- ============================================================
-- 7. DENSITY_CELLS (1:N per run — future use)
-- ============================================================
create table public.density_cells (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.simulation_runs(id) on delete cascade,
  cell_x       integer not null,
  cell_y       integer not null,
  peak_density numeric not null,
  step         integer not null
);

create index idx_density_cells_run_id on public.density_cells(run_id);

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

-- profiles: users see/edit only their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- simulation_runs: users CRUD only their own runs
alter table public.simulation_runs enable row level security;

create policy "Users can view own runs"
  on public.simulation_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own runs"
  on public.simulation_runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own runs"
  on public.simulation_runs for update
  using (auth.uid() = user_id);

create policy "Users can delete own runs"
  on public.simulation_runs for delete
  using (auth.uid() = user_id);

-- Helper: child tables check ownership via simulation_runs
-- simulation_configs
alter table public.simulation_configs enable row level security;

create policy "Users can view own configs"
  on public.simulation_configs for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert own configs"
  on public.simulation_configs for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can update own configs"
  on public.simulation_configs for update
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can delete own configs"
  on public.simulation_configs for delete
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

-- simulation_results
alter table public.simulation_results enable row level security;

create policy "Users can view own results"
  on public.simulation_results for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert own results"
  on public.simulation_results for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can update own results"
  on public.simulation_results for update
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

-- simulation_zones
alter table public.simulation_zones enable row level security;

create policy "Users can view own zones"
  on public.simulation_zones for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert own zones"
  on public.simulation_zones for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can update own zones"
  on public.simulation_zones for update
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can delete own zones"
  on public.simulation_zones for delete
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

-- simulation_bottlenecks
alter table public.simulation_bottlenecks enable row level security;

create policy "Users can view own bottlenecks"
  on public.simulation_bottlenecks for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert own bottlenecks"
  on public.simulation_bottlenecks for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can update own bottlenecks"
  on public.simulation_bottlenecks for update
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can delete own bottlenecks"
  on public.simulation_bottlenecks for delete
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

-- density_cells
alter table public.density_cells enable row level security;

create policy "Users can view own density cells"
  on public.density_cells for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert own density cells"
  on public.density_cells for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can update own density cells"
  on public.density_cells for update
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can delete own density cells"
  on public.density_cells for delete
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));
