-- Run in Supabase SQL Editor after schema.sql (or merge into one migration).
-- Per-quote share links: GET /q/:id loads payload JSON (React + Vercel + Supabase).

create extension if not exists "pgcrypto";

create table if not exists public.shared_quotes (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists shared_quotes_expires_at_idx on public.shared_quotes (expires_at);

alter table public.shared_quotes enable row level security;

drop policy if exists "shared_quotes_select_anon" on public.shared_quotes;
drop policy if exists "shared_quotes_insert_anon" on public.shared_quotes;

-- Read: only non-expired rows (null expires_at = never)
create policy "shared_quotes_select_anon"
  on public.shared_quotes for select
  to anon, authenticated
  using (expires_at is null or expires_at > now());

-- Create: same model as admin_settings in this project (anon from browser)
create policy "shared_quotes_insert_anon"
  on public.shared_quotes for insert
  to anon, authenticated
  with check (true);
