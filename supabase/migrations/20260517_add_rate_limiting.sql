-- 20260517 - Rate limit high-risk authenticated actions
-- ============================================================
-- Stores small audit-style event rows and exposes one atomic RPC for
-- checking + recording an action inside the database.

create table if not exists public.rate_limit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  action      text not null,
  resource_id text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_user_action_created
  on public.rate_limit_events(user_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

drop policy if exists "Users can view own rate limit events" on public.rate_limit_events;
create policy "Users can view own rate limit events"
  on public.rate_limit_events for select
  using (auth.uid() = user_id);

grant select on public.rate_limit_events to authenticated;

create or replace function public.record_rate_limit_event(
  p_action text,
  p_limit integer,
  p_window_seconds integer,
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception 'Rate limit action is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit <= 0 or p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'Invalid rate limit configuration' using errcode = '22023';
  end if;

  -- Serialize each user's action window so concurrent tabs cannot slip past
  -- the count check before the event row is inserted.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_action, 0));

  v_window_start := now() - make_interval(secs => p_window_seconds);

  delete from public.rate_limit_events
  where created_at < now() - interval '1 day';

  select count(*)
    into v_count
  from public.rate_limit_events
  where user_id = v_user_id
    and action = p_action
    and created_at >= v_window_start;

  if v_count >= p_limit then
    raise exception 'Rate limit reached: wait before trying again.' using errcode = 'P0001';
  end if;

  insert into public.rate_limit_events (user_id, action, resource_id)
  values (v_user_id, p_action, p_resource_id);
end;
$$;

revoke all on function public.record_rate_limit_event(text, integer, integer, text) from public;
grant execute on function public.record_rate_limit_event(text, integer, integer, text) to authenticated;

create or replace function public.enforce_simulation_run_create_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    perform public.record_rate_limit_event('simulation_run:create', 5, 300, new.building_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_simulation_run_create_rate_limit on public.simulation_runs;
create trigger trg_simulation_run_create_rate_limit
  before insert on public.simulation_runs
  for each row
  execute function public.enforce_simulation_run_create_rate_limit();

create or replace function public.enforce_profile_update_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.display_name is distinct from new.display_name then
    perform public.record_rate_limit_event('profile:update', 5, 60, new.id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profile_update_rate_limit on public.profiles;
create trigger trg_profile_update_rate_limit
  before update on public.profiles
  for each row
  execute function public.enforce_profile_update_rate_limit();

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

  perform public.record_rate_limit_event('simulation_run:delete', 10, 300, p_run_id::text);

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

  perform public.record_rate_limit_event('simulation_run:reset_all', 1, 300, 'all');

  delete from public.simulation_runs
  where user_id = v_user_id;
end;
$$;

drop policy if exists "Users can delete own runs" on public.simulation_runs;

revoke all on function public.delete_simulation_run_rate_limited(uuid) from public;
revoke all on function public.reset_simulation_data_rate_limited() from public;
grant execute on function public.delete_simulation_run_rate_limited(uuid) to authenticated;
grant execute on function public.reset_simulation_data_rate_limited() to authenticated;
