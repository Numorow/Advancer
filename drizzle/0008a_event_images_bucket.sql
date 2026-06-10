-- Advancer M9 — private bucket for event cover images.
-- Applied via the Supabase MCP execute_sql (storage schema); mirrors the private
-- event-docs / supplier-docs buckets. Served via createSignedUrls.

insert into storage.buckets (id, name, public) values ('event-images', 'event-images', false)
on conflict (id) do nothing;

create policy event_images_read   on storage.objects for select using (bucket_id = 'event-images');
create policy event_images_write  on storage.objects for insert with check (bucket_id = 'event-images');
create policy event_images_delete on storage.objects for delete using (bucket_id = 'event-images');
