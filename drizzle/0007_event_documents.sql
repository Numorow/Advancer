-- Advancer M6 — per-event document register.
-- A row is either an uploaded file (file_path, event-docs bucket) or an external
-- link (external_url), optionally tied to a supplier / RFQ / budget line / schedule
-- entry. RLS uses the INLINE event predicate (helpers live in private), matching 0006.

create table if not exists event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  title text not null,
  category text,
  file_path text,
  external_url text,
  supplier_id uuid references suppliers(id) on delete set null,
  rfq_id uuid references rfqs(id) on delete set null,
  budget_item_id uuid references budget_items(id) on delete set null,
  schedule_entry_id uuid references schedule_entries(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists event_documents_event_idx on event_documents (event_id);

alter table event_documents enable row level security;

create policy event_documents_read on event_documents for select using (
  exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
          where e.id = event_documents.event_id and m.user_id = auth.uid())
);
create policy event_documents_write on event_documents for all
  using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                 where e.id = event_documents.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                      where e.id = event_documents.event_id and m.user_id = auth.uid() and m.role <> 'viewer'));
