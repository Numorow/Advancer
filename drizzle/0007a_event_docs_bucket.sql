-- Advancer M6 — private storage bucket for the event documents register.
-- Applied via the Supabase MCP execute_sql (storage schema); mirrors the existing
-- private supplier-docs / rfq-attachments / site-photos buckets. Served via
-- createSignedUrls (see app/(app)/events/[id]/documents/page.tsx).

insert into storage.buckets (id, name, public) values ('event-docs', 'event-docs', false)
on conflict (id) do nothing;

create policy event_docs_read   on storage.objects for select using (bucket_id = 'event-docs');
create policy event_docs_write  on storage.objects for insert with check (bucket_id = 'event-docs');
create policy event_docs_delete on storage.objects for delete using (bucket_id = 'event-docs');

-- Also add DELETE policies to the M5 doc buckets so removeSupplierDocument /
-- removeRfqAttachment actually delete the stored object (they previously had only
-- read+insert policies, leaving files orphaned on delete).
create policy supplier_docs_delete on storage.objects for delete using (bucket_id = 'supplier-docs');
create policy rfq_attach_delete    on storage.objects for delete using (bucket_id = 'rfq-attachments');
