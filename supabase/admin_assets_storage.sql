-- הרצה חד-פעמית ב-Supabase SQL Editor
-- דאטהשיטים / לוגואים גדולים — ב-Storage, לא בתוך jsonb של admin_settings

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-assets',
  'admin-assets',
  true,
  10485760,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "admin_assets_select" on storage.objects;
drop policy if exists "admin_assets_insert" on storage.objects;
drop policy if exists "admin_assets_update" on storage.objects;
drop policy if exists "admin_assets_delete" on storage.objects;

create policy "admin_assets_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'admin-assets');

create policy "admin_assets_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'admin-assets');

create policy "admin_assets_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'admin-assets')
  with check (bucket_id = 'admin-assets');

create policy "admin_assets_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'admin-assets');
