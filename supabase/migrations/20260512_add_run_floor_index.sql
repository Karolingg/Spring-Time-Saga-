-- ============================================================
-- 20260512 — Capture simulated floor on simulation_runs
-- ============================================================
-- Heatmap views need to know which floor a run was actually
-- simulated on so the overlay can be hidden/disabled when the
-- user is looking at a different floor of the same building.
-- Nullable so legacy rows keep working.

alter table public.simulation_runs
  add column if not exists floor_index integer;
