-- Run once in Supabase SQL Editor if you see:
--   permission denied for table admin_settings_history
--
-- Common causes:
-- 1) Trigger still INSERTs into admin_settings_history on every admin_settings save.
-- 2) You ran REVOKE on admin_settings_history for anon/authenticated — trigger fails.

-- If your trigger/function names differ, check:
--   select tgname from pg_trigger join pg_class on pg_trigger.tgrelid = pg_class.oid
--   where relname = 'admin_settings';

-- Trigger name may be trg_admin_settings_history or log_admin_settings_history (drop both).

drop trigger if exists trg_admin_settings_history on public.admin_settings;
drop trigger if exists log_admin_settings_history on public.admin_settings;

drop function if exists public.log_admin_settings_history();

drop table if exists public.admin_settings_history;
