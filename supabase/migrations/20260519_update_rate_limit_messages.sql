-- 20260519 - Make rate limit messages independent of exact limits
-- ============================================================
-- Keeps user-facing copy stable when limit_count/window_seconds are tuned.

update public.rate_limit_rules
set
  window_seconds = 150,
  user_message = 'Run save limit reached. Please wait a few minutes before saving another autonomous run.'
where action = 'simulation_run:create';

update public.rate_limit_rules
set
  window_seconds = 150,
  user_message = 'Run delete limit reached. Please wait a few minutes before deleting another run.'
where action = 'simulation_run:delete';

update public.rate_limit_rules
set
  window_seconds = 150,
  user_message = 'Reset limit reached. Please wait a few minutes before resetting simulation data again.'
where action = 'simulation_run:reset_all';

update public.rate_limit_rules
set
  window_seconds = 60,
  user_message = 'Profile update limit reached. Please wait a moment before saving again.'
where action = 'profile:update';
