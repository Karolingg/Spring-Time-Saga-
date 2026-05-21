-- ============================================================
-- 20260516 — Persist scenario severity on simulation_runs
-- ============================================================
-- The Evacuation Readiness Score uses two integrity safeguards:
--
--   (A) Difficulty weighting — each run's contribution to the building's
--       score is multiplied by a scenario weight (minor 0.6 × moderate 1.0
--       × severe 1.4), so a building cannot inflate its grade with a string
--       of trivial drills.
--
--   (C) Mandatory coverage cap — a building cannot earn higher than a B
--       without at least one severe drill, and cannot earn higher than a C
--       without at least one moderate drill. This is enforced in the
--       reporting layer.
--
-- Both safeguards need to know which severity bucket each saved run fell
-- into. For earthquakes this comes straight from the chosen quake scenario;
-- for fire it's derived from the placed hazards at run time (see
-- `computeFireSeverity` in autonomous-analytics.ts).
--
-- Nullable so legacy rows (saved before this column existed) keep working —
-- the analytics service treats null as "unclassified" and folds it into the
-- minor bucket for cap purposes.
alter table public.simulation_runs
  add column if not exists scenario_severity text
    check (scenario_severity in ('minor', 'moderate', 'severe'));

create index if not exists idx_simulation_runs_scenario_severity
  on public.simulation_runs(scenario_severity);
