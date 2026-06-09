-- Advancer M5 — storage buckets for supplier documents + RFQ quote attachments.
-- Applied via the Supabase MCP execute_sql (storage schema), mirroring the
-- existing private `site-photos` / `imports` buckets. Both are PRIVATE; the app
-- serves files with createSignedUrls (see app/(app)/events/[id]/site/page.tsx).

insert into storage.buckets (id, name, public) values
  ('supplier-docs', 'supplier-docs', false),
  ('rfq-attachments', 'rfq-attachments', false)
on conflict (id) do nothing;

-- Authenticated read + insert, gated by bucket (same shape as site_photos_*).
create policy supplier_docs_read  on storage.objects for select using (bucket_id = 'supplier-docs');
create policy supplier_docs_write on storage.objects for insert with check (bucket_id = 'supplier-docs');
create policy rfq_attach_read     on storage.objects for select using (bucket_id = 'rfq-attachments');
create policy rfq_attach_write    on storage.objects for insert with check (bucket_id = 'rfq-attachments');
