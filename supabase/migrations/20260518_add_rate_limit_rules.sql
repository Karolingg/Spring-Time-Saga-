-- 20260517 - Make rate limits editable from one table
-- ============================================================
-- To change a limit later, edit the matching row in Supabase SQL editor:
--
--   update public.rate_limit_rules
--   set limit_count = 8, window_seconds = 300
--   where action = 'simulation_run:create';
--
-- The triggers/RPCs below read this table at runtime, so no code deploy is
-- needed after changing a value.

create table if not exists public.rate_limit_rules (
  action         text primary key,
  limit_count    integer not null check (limit_count > 0),
  window_seconds integer not null check (window_seconds > 0),
  user_message   text not null,
  description    text,
  updated_at     timestamptz not null default now()
);

insert into public.rate_limit_rules (action, limit_count, window_seconds, user_message, description)
values
  (
    'simulation_run:create',
    5,
    150,
    'Rate limit reached: you can save 5 autonomous runs every 5 minutes. Please wait before saving another run.',
    'Completed autonomous simulations saved to analysis history.'
  ),
  (
    'simulation_run:delete',
    10,
    150,
    'Rate limit reached: you can delete 10 runs every 5 minutes. Please wait before deleting another run.',
    'Individual run deletion from analysis.'
  ),
  (
    'simulation_run:reset_all',
    1,
    150,
    'Rate limit reached: you can reset all simulation data once every 5 minutes. Please wait before resetting again.',
    'Bulk deletion of all simulation data for the current user.'
  ),
  (
    'profile:update',
    5,
    60,
    'Rate limit reached: you can update your profile 5 times per minute. Please wait before saving again.',
    'Display-name updates on the settings page.'
  )
on conflict (action) do nothing;

alter table public.rate_limit_rules enable row level security;

drop policy if exists "Authenticated users can view rate limit rules" on public.rate_limit_rules;
create policy "Authenticated users can view rate limit rules"
  on public.rate_limit_rules for select
  to authenticated
  using (true);

grant select on public.rate_limit_rules to authenticated;

create or replace function public.touch_rate_limit_rule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rate_limit_rules_touch_updated_at on public.rate_limit_rules;
create trigger trg_rate_limit_rules_touch_updated_at
  before update on public.rate_limit_rules
  for each row
  execute function public.touch_rate_limit_rule_updated_at();

create or replace function public.record_configured_rate_limit_event(
  p_action text,
  p_resource_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz;
  v_count integer;
  v_limit_count integer;
  v_window_seconds integer;
  v_message text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select limit_count, window_seconds, user_message
    into v_limit_count, v_window_seconds, v_message
  from public.rate_limit_rules
  where action = p_action;

  if v_limit_count is null then
    raise exception 'Rate limit rule is missing for action: %', p_action using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_action, 0));

  v_window_start := now() - make_interval(secs => v_window_seconds);

  delete from public.rate_limit_events
  where created_at < now() - interval '1 day';

  select count(*)
    into v_count
  from public.rate_limit_events
  where user_id = v_user_id
    and action = p_action
    and created_at >= v_window_start;

  if v_count >= v_limit_count then
    raise exception '%', v_message using errcode = 'P0001';
  end if;

  insert into public.rate_limit_events (user_id, action, resource_id)
  values (v_user_id, p_action, p_resource_id);
end;
$$;

revoke all on function public.record_configured_rate_limit_event(text, text) from public;
grant execute on function public.record_configured_rate_limit_event(text, text) to authenticated;

revoke all on function public.record_rate_limit_event(text, integer, integer, text) from public;

create or replace function public.enforce_simulation_run_create_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    perform public.record_configured_rate_limit_event('simulation_run:create', new.building_id);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_profile_update_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.display_name is distinct from new.display_name then
    perform public.record_configured_rate_limit_event('profile:update', new.id::text);
  end if;

  return new;
end;
$$;

create or replace function public.delete_simulation_run_rate_limited(p_run_id uuid)
returns void
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

  perform public.record_configured_rate_limit_event('simulation_run:delete', p_run_id::text);

  delete from public.simulation_runs
  where id = p_run_id and user_id = v_user_id;
end;
$$;

create or replace function public.reset_simulation_data_rate_limited()
returns void
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

  perform public.record_configured_rate_limit_event('simulation_run:reset_all', 'all');

  delete from public.simulation_runs
  where user_id = v_user_id;
end;
$$;
