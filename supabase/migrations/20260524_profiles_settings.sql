alter table profiles
  add column if not exists phone text,
  add column if not exists avatar_url text;

drop policy if exists "site_content_update_receptionist" on site_content_pages;
create policy "site_content_update_receptionist" on site_content_pages
  for all
  using (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'))
  with check (exists (select 1 from profiles p where p.auth_id = auth.uid() and p.role = 'RECEPTIONIST'));
