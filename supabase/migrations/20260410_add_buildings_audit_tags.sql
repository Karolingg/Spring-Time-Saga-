-- ============================================================
-- 20260410 — Add Buildings, Audit Logs, Run Tags, Density Cell Write
-- ============================================================

-- 1. BUILDINGS TABLE (replaces hardcoded CAMPUS_BUILDINGS)
create table public.buildings (
  id              text primary key,
  name            text not null,
  type            text not null,
  polygon         jsonb not null,  -- GeoJSON coordinates [[lat, lng], ...]
  capacity        integer not null check (capacity > 0),
  floors          integer not null check (floors > 0),
  exits           integer not null check (exits > 0),
  risk_level      text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  last_drill_date date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_buildings_risk_level on public.buildings(risk_level);

-- 2. RUN_TAGS TABLE (for categorizing runs)
create table public.run_tags (
  id        uuid primary key default gen_random_uuid(),
  run_id    uuid not null references public.simulation_runs(id) on delete cascade,
  tag       text not null,
  created_at timestamptz not null default now(),
  unique(run_id, tag)
);

create index idx_run_tags_run_id on public.run_tags(run_id);
create index idx_run_tags_tag on public.run_tags(tag);

-- 3. AUDIT_LOGS TABLE (for compliance & accountability)
create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  action         text not null,
  resource_type  text not null,  -- 'run', 'profile', 'building', 'drill'
  resource_id    text not null,
  changes_json   jsonb,          -- optional: what changed
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_resource_type on public.audit_logs(resource_type);
create index idx_audit_logs_created_at on public.audit_logs(created_at);

-- 4. ALTER simulation_runs: add notes and building_id
alter table public.simulation_runs add column if not exists notes text;
alter table public.simulation_runs add column if not exists building_id text references public.buildings(id) on delete set null;

-- 5. RLS POLICIES

-- Buildings: public read-only (all users can see)
alter table public.buildings enable row level security;

create policy "Users can view buildings"
  on public.buildings for select
  using (true);

-- Run tags: users can view/insert/delete tags on their own runs
alter table public.run_tags enable row level security;

create policy "Users can view run tags on own runs"
  on public.run_tags for select
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can insert tags on own runs"
  on public.run_tags for insert
  with check (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

create policy "Users can delete tags on own runs"
  on public.run_tags for delete
  using (run_id in (select id from public.simulation_runs where user_id = auth.uid()));

-- Audit logs: users can view logs for their own resources only
alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (user_id = auth.uid() or user_id is null);

create policy "System can insert audit logs"
  on public.audit_logs for insert
  with check (true);

-- 6. SEED INITIAL BUILDINGS DATA (from CAMPUS_BUILDINGS hardcoded list)
-- These coordinates are [lat, lng] format and will be converted to GeoJSON on insert
insert into public.buildings (id, name, type, polygon, capacity, floors, exits, risk_level, last_drill_date, notes) values
('admin-building', 'Administration Building', 'Administrative', '[[10.3240, 123.8978], [10.3240, 123.8992], [10.3232, 123.8992], [10.3232, 123.8978]]', 200, 3, 3, 'MEDIUM', '2025-08-01', 'Central administrative offices. Houses the registrar, cashier, and chancellor''s office.'),
('as-west-wing', 'AS West Wing', 'Academic', '[[10.3256, 123.8992], [10.3256, 123.9005], [10.3248, 123.9005], [10.3248, 123.8992]]', 350, 2, 4, 'MEDIUM', '2025-10-05', 'Western section of Arts & Sciences. Lecture halls and faculty offices.'),
('as-east-wing', 'AS East Wing', 'Academic', '[[10.3250, 123.9005], [10.3250, 123.9018], [10.3242, 123.9018], [10.3242, 123.9005]]', 300, 2, 4, 'MEDIUM', '2025-10-05', 'Eastern extension with lab classes and overflow lecture rooms.'),
('som-admin', 'SOM Administration', 'Administrative', '[[10.3243, 123.8972], [10.3243, 123.8982], [10.3237, 123.8982], [10.3237, 123.8972]]', 80, 2, 2, 'LOW', '2025-07-10', 'School of Management admin offices.'),
('som-building-1', 'SOM Building 1', 'Academic', '[[10.3249, 123.8972], [10.3249, 123.8982], [10.3243, 123.8982], [10.3243, 123.8972]]', 400, 3, 3, 'MEDIUM', '2025-08-20', 'Primary SOM classroom building with tiered halls.'),
('som-building-2', 'SOM Building 2', 'Academic', '[[10.3237, 123.8972], [10.3237, 123.8982], [10.3231, 123.8982], [10.3231, 123.8972]]', 160, 2, 3, 'LOW', '2025-08-20', 'Connected to SOM Building 1 via walkway.'),
('union-building', 'Union Building', 'Student Services', '[[10.3260, 123.9005], [10.3260, 123.9018], [10.3252, 123.9018], [10.3252, 123.9005]]', 500, 2, 3, 'HIGH', '2025-09-01', 'Student union offices, canteen, event halls.'),
('social-sciences', 'Social Sciences Building', 'Academic', '[[10.3259, 123.8965], [10.3259, 123.8975], [10.3253, 123.8975], [10.3253, 123.8965]]', 250, 2, 3, 'LOW', '2025-09-12', 'Houses psychology, public administration, political science.'),
('science-building', 'Science Building', 'Academic', '[[10.3232, 123.8978], [10.3232, 123.8992], [10.3224, 123.8992], [10.3224, 123.8978]]', 320, 3, 4, 'HIGH', '2025-10-05', 'Chemistry, biology, physics labs with safety equipment.'),
('liadlaw-hall', 'Liadlaw Hall', 'Academic', '[[10.3226, 123.8978], [10.3226, 123.8992], [10.3218, 123.8992], [10.3218, 123.8978]]', 600, 2, 3, 'MEDIUM', '2025-09-20', 'Multi-purpose assembly hall. Limited stairwell access.'),
('up-cebu-library', 'UP Cebu Library', 'Library', '[[10.3203, 123.8962], [10.3203, 123.8997], [10.3224, 123.8997], [10.3224, 123.8962]]', 180, 2, 2, 'LOW', '2025-08-15', 'Main library with reading rooms and digital terminals.'),
('tech-innovation', 'Technology Innovation Center', 'Research', '[[10.3214, 123.8975], [10.3214, 123.8988], [10.3206, 123.8988], [10.3206, 123.8975]]', 80, 2, 2, 'LOW', '2025-07-15', 'Computer labs and research facilities. Emergency power shutoff.'),
('up-high-school', 'UP High School - Cebu', 'Secondary School', '[[10.3213, 123.8942], [10.3213, 123.9048], [10.3224, 123.9048], [10.3224, 123.8942]]', 800, 2, 4, 'HIGH', '2025-08-20', 'Integrated lab high school with science and computer rooms.'),
('arts-design', 'Arts and Design Workshop', 'Academic', '[[10.3253, 123.8965], [10.3253, 123.8975], [10.3247, 123.8975], [10.3247, 123.8965]]', 100, 2, 2, 'LOW', '2025-08-15', 'Art studios and workshops. Flammable materials stored.'),
('malacanang-cottage', 'Malacanang Cottage', 'Administrative', '[[10.3226, 123.8998], [10.3226, 123.9012], [10.3218, 123.9012], [10.3218, 123.8998]]', 60, 1, 2, 'LOW', '2025-06-20', 'Heritage cottage for administrative functions.'),
('balay-warangao', 'Balay Warangao', 'Administrative', '[[10.3220, 123.8975], [10.3220, 123.8988], [10.3212, 123.8988], [10.3212, 123.8975]]', 80, 2, 2, 'LOW', '2025-07-15', 'Student affairs and guidance offices.'),
('computer-room', 'Computer Room', 'Research', '[[10.3212, 123.9012], [10.3212, 123.9025], [10.3230, 123.9025], [10.3230, 123.9012]]', 60, 1, 2, 'LOW', '2025-06-30', 'Specialized computer facilities.'),
('cdcp-center', 'CDCP Center', 'Research', '[[10.3206, 123.9025], [10.3206, 123.9038], [10.3214, 123.9038], [10.3214, 123.9025]]', 70, 1, 2, 'LOW', '2025-07-20', 'Center for Development and Community Programs.'),
('volleyball-court', 'UPC Volleyball Court', 'Recreational', '[[10.3251, 123.8982], [10.3251, 123.8992], [10.3243, 123.8992], [10.3243, 123.8982]]', 200, 1, 4, 'LOW', '2025-06-05', 'Open-air court. Secondary evacuation assembly point.'),
('soccer-field', 'UPC Soccer Field', 'Recreational', '[[10.3244, 123.9018], [10.3244, 123.9038], [10.3232, 123.9038], [10.3232, 123.9018]]', 500, 1, 4, 'LOW', '2025-06-10', 'Primary evacuation assembly point for upper campus.')
on conflict do nothing;
