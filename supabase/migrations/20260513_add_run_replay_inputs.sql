-- ============================================================
-- 20260513 — Persist inputs needed to faithfully replay a run
-- ============================================================
-- For the analysis "replay" view to reproduce the exact simulation,
-- we need:
--   • the user-placed hazards (so fire/smoke/debris reappear in the
--     same spots with the same radii),
--   • the per-room agent allocation (population distribution), and
--   • the RNG seed (so reaction delays, speeds, and routing jitter
--     are reproduced agent-for-agent).
-- All three are nullable so legacy rows still work; replay degrades
-- gracefully when they're missing.

alter table public.simulation_runs
  add column if not exists hazards jsonb,
  add column if not exists agents_per_room jsonb,
  add column if not exists seed bigint;
