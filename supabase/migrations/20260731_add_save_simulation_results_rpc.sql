-- 20260731 - Atomic simulation results save
-- ============================================================
-- saveSimulationResults() previously ran the results upsert, the
-- zones delete+insert, the bottlenecks delete+insert, and the run
-- status update as separate client round trips. A failure partway
-- through (e.g. the zones insert) left the run with deleted zones
-- and no replacement, with no rollback. This RPC does all of it
-- inside one function invocation, which Postgres runs as a single
-- transaction: any error rolls back every write.

create or replace function public.save_simulation_results(
  p_run_id uuid,
  p_total_steps integer,
  p_evacuated_count integer,
  p_max_congestion integer,
  p_evacuation_time numeric,
  p_congestion_exposure numeric,
  p_global_peak_density numeric,
  p_status text,
  p_zones jsonb,
  p_bottlenecks jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.simulation_runs
    where id = p_run_id and user_id = v_user_id
  ) then
    raise exception 'Simulation run not found' using errcode = 'P0002';
  end if;

  insert into public.simulation_results (
    run_id, total_steps, evacuated_count, max_congestion,
    evacuation_time, congestion_exposure, global_peak_density
  ) values (
    p_run_id, p_total_steps, p_evacuated_count, p_max_congestion,
    p_evacuation_time, p_congestion_exposure, p_global_peak_density
  )
  on conflict (run_id) do update set
    total_steps = excluded.total_steps,
    evacuated_count = excluded.evacuated_count,
    max_congestion = excluded.max_congestion,
    evacuation_time = excluded.evacuation_time,
    congestion_exposure = excluded.congestion_exposure,
    global_peak_density = excluded.global_peak_density;

  delete from public.simulation_zones where run_id = p_run_id;

  insert into public.simulation_zones (
    run_id, zone_name, intensity, agent_count, bottleneck_count, risk_level, lat, lng
  )
  select
    p_run_id,
    z->>'zoneName',
    (z->>'intensity')::numeric,
    (z->>'agentCount')::integer,
    (z->>'bottleneckCount')::integer,
    z->>'riskLevel',
    (z->>'lat')::numeric,
    (z->>'lng')::numeric
  from jsonb_array_elements(coalesce(p_zones, '[]'::jsonb)) as z;

  delete from public.simulation_bottlenecks where run_id = p_run_id;

  insert into public.simulation_bottlenecks (
    run_id, zone_name, severity, cell_x, cell_y, description
  )
  select
    p_run_id,
    b->>'zoneName',
    b->>'severity',
    (b->>'cellX')::integer,
    (b->>'cellY')::integer,
    b->>'description'
  from jsonb_array_elements(coalesce(p_bottlenecks, '[]'::jsonb)) as b;

  update public.simulation_runs
  set status = p_status, updated_at = now()
  where id = p_run_id;
end;
$$;

revoke all on function public.save_simulation_results(
  uuid, integer, integer, integer, numeric, numeric, numeric, text, jsonb, jsonb
) from public;
grant execute on function public.save_simulation_results(
  uuid, integer, integer, integer, numeric, numeric, numeric, text, jsonb, jsonb
) to authenticated;
