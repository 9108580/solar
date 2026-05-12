-- Per-quote share links (/q/:id). Run in Supabase SQL Editor (idempotent — safe to re-run).
-- Links are valid 14 days; after expiry the client sees WhatsApp to the agent (no payload leak).

create extension if not exists "pgcrypto";

create table if not exists public.shared_quotes (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  agent_phone text,
  agent_name text,
  company_phone text
);

alter table public.shared_quotes add column if not exists agent_phone text;
alter table public.shared_quotes add column if not exists agent_name text;
alter table public.shared_quotes add column if not exists company_phone text;

create index if not exists shared_quotes_expires_at_idx on public.shared_quotes (expires_at);

alter table public.shared_quotes enable row level security;

-- No direct SELECT for anon — use get_shared_quote() only (hides expired payload).
drop policy if exists "shared_quotes_select_anon" on public.shared_quotes;
drop policy if exists "shared_quotes_insert_anon" on public.shared_quotes;

create policy "shared_quotes_insert_anon"
  on public.shared_quotes for insert
  to anon, authenticated
  with check (true);

-- Returns JSON: { ok, reason?, payload?, agent_phone?, agent_name?, company_phone? }
-- On expired: returns contact fields only, deletes row (one-time notice + cleanup).
create or replace function public.get_shared_quote(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  out jsonb;
begin
  select id, payload, expires_at, agent_phone, agent_name, company_phone
    into r
  from public.shared_quotes
  where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if r.expires_at is not null and r.expires_at <= now() then
    out := jsonb_build_object(
      'ok', false,
      'reason', 'expired',
      'agent_phone', coalesce(r.agent_phone, ''),
      'agent_name', coalesce(r.agent_name, ''),
      'company_phone', coalesce(r.company_phone, '')
    );
    delete from public.shared_quotes where id = p_id;
    return out;
  end if;

  return jsonb_build_object('ok', true, 'payload', r.payload);
end;
$$;

revoke all on function public.get_shared_quote(uuid) from public;
grant execute on function public.get_shared_quote(uuid) to anon, authenticated;

-- Optional: delete rows that expired but were never opened (no RPC). With pg_cron, e.g. daily:
--   DELETE FROM public.shared_quotes WHERE expires_at IS NOT NULL AND expires_at < NOW();
