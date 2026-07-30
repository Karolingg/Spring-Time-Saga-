-- 20260801 - Real profile role
-- ============================================================
-- app/settings/page.tsx displayed a hardcoded "Administrator" label for
-- every user, not backed by any actual role/permission data. This adds a
-- real role column so the UI reflects a real value instead of a fake one.
-- There is no admin workflow elsewhere in the app yet, so every existing
-- and new profile defaults to 'user'; promoting to 'admin' is a manual
-- operation until an admin-management flow exists.

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));
