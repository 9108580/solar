-- Run in Supabase: SQL Editor -> New query -> Paste -> Run
-- Strict policy:
-- Only AUTHENTICATED users can read/write settings.
-- Anonymous users should see only the app login screen and have no settings data access.

create table if not exists public.admin_settings (
  id int primary key default 1,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint admin_settings_single_row check (id = 1)
);

alter table public.admin_settings
  add column if not exists revision bigint not null default 0;

alter table public.admin_settings enable row level security;

create table if not exists public.admin_settings_history (
  history_id bigserial primary key,
  settings_id int not null,
  revision bigint not null,
  payload jsonb not null,
  changed_at timestamptz not null default now()
);

create or replace function public.log_admin_settings_history()
returns trigger
language plpgsql
as $$
begin
  insert into public.admin_settings_history (settings_id, revision, payload, changed_at)
  values (new.id, new.revision, new.payload, now());
  return new;
end;
$$;

drop trigger if exists trg_admin_settings_history on public.admin_settings;
create trigger trg_admin_settings_history
after insert or update on public.admin_settings
for each row execute function public.log_admin_settings_history();

drop policy if exists "admin_settings_select_anon" on public.admin_settings;
drop policy if exists "admin_settings_insert_anon" on public.admin_settings;
drop policy if exists "admin_settings_update_anon" on public.admin_settings;
drop policy if exists "admin_settings_select_all" on public.admin_settings;
drop policy if exists "admin_settings_select_authenticated" on public.admin_settings;
drop policy if exists "admin_settings_insert_authenticated" on public.admin_settings;
drop policy if exists "admin_settings_update_authenticated" on public.admin_settings;

create policy "admin_settings_select_authenticated"
  on public.admin_settings for select
  to authenticated
  using (true);

create policy "admin_settings_insert_authenticated"
  on public.admin_settings for insert
  to authenticated
  with check (true);

create policy "admin_settings_update_authenticated"
  on public.admin_settings for update
  to authenticated
  using (true)
  with check (true);
