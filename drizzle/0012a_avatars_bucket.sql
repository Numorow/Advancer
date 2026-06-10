-- Advancer M16 — private bucket for profile avatars.
-- Applied via the Supabase MCP execute_sql (storage schema). Objects live at
-- <user_id>/<uuid>.<ext>; any signed-in user can read (org-mates render each
-- other's photos via signed URLs) but only the owner can write/delete theirs.

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
