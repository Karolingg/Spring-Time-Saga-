-- ============================================================
-- 20260515 — Fix OAuth profile trigger + audit log RLS
-- ============================================================

-- FIX 1: handle_new_user — capture Google OAuth display name
-- ---------------------------------------------------------------
-- The original trigger only inserted id + email. For Google OAuth
-- users, the display name lives in raw_user_meta_data->>'full_name'
-- (or ->>'name'). Without this fix, every Google OAuth user gets a
-- NULL display_name in profiles.
--
-- Also adds ON CONFLICT DO UPDATE so the trigger is idempotent —
-- Supabase can fire it more than once per user in OAuth edge cases.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set
      email        = excluded.email,
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      updated_at   = now();
  return new;
end;
$$;

-- FIX 2: audit_logs insert policy — restrict to own user_id
-- ---------------------------------------------------------------
-- The original policy used `with check (true)` which allowed any
-- authenticated user to insert a row with any user_id value.
-- Replacing with a policy that only allows inserting rows where
-- user_id matches the calling user (or is null for system events).
-- ---------------------------------------------------------------
drop policy if exists "System can insert audit logs" on public.audit_logs;

create policy "Users can insert own audit logs"
  on public.audit_logs for insert
  with check (user_id = auth.uid() or user_id is null);
