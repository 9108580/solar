-- Run in Supabase: SQL Editor -> New query -> Paste -> Run
-- WARNING: anon can read/write this row. Anyone with your anon key (exposed in the browser bundle)
-- can change prices. For stricter security later: use Supabase Auth or Edge Functions + service_role.

create table if not exists public.admin_settings (
  id int primary key default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint admin_settings_single_row check (id = 1)
);

alter table public.admin_settings enable row level security;

drop policy if exists "admin_settings_select_anon" on public.admin_settings;
drop policy if exists "admin_settings_insert_anon" on public.admin_settings;
drop policy if exists "admin_settings_update_anon" on public.admin_settings;
drop policy if exists "admin_settings_select_all" on public.admin_settings;
drop policy if exists "admin_settings_select_authenticated" on public.admin_settings;
drop policy if exists "admin_settings_insert_authenticated" on public.admin_settings;
drop policy if exists "admin_settings_update_authenticated" on public.admin_settings;

create policy "admin_settings_select_anon"
  on public.admin_settings for select
  to anon, authenticated
  using (true);

create policy "admin_settings_insert_anon"
  on public.admin_settings for insert
  to anon, authenticated
  with check (true);

create policy "admin_settings_update_anon"
  on public.admin_settings for update
  to anon, authenticated
  using (true)
  with check (true);
