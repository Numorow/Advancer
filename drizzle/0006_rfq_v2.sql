-- Advancer M5 — RFQ build-out: itemised quotes, quote/supplier attachments,
-- supplier contacts/documents, and an RFQ response-by date.
--
-- RLS predicates are INLINED (not via the is_org_member / can_access_event
-- helpers) — the helpers now live in a `private` schema, and inlining keeps
-- these policies independent of where they sit, matching drizzle/0001a_*.

/* --------------------------------------------------------------- rfqs column */

alter table rfqs add column if not exists response_due_date date;

/* ------------------------------------------------------- new tables (DDL) */

create table if not exists rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_recipient_id uuid not null references rfq_recipients(id) on delete cascade,
  rfq_item_id uuid not null references rfq_items(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  unit_price_cents integer,
  line_total_cents integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists rfq_quotes_recipient_idx on rfq_quotes (rfq_recipient_id);
create unique index if not exists rfq_quotes_recipient_item_uq on rfq_quotes (rfq_recipient_id, rfq_item_id);

create table if not exists rfq_attachments (
  id uuid primary key default gen_random_uuid(),
  rfq_recipient_id uuid not null references rfq_recipients(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  label text,
  file_path text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists rfq_attachments_recipient_idx on rfq_attachments (rfq_recipient_id);

create table if not exists supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists supplier_contacts_supplier_idx on supplier_contacts (supplier_id);

create table if not exists supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  label text,
  doc_type text,
  file_path text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists supplier_documents_supplier_idx on supplier_documents (supplier_id);

/* -------------------------------------------------------------- enable RLS */

alter table rfq_quotes          enable row level security;
alter table rfq_attachments     enable row level security;
alter table supplier_contacts   enable row level security;
alter table supplier_documents  enable row level security;

/* --------------------------------------------------- event-scoped policies */

create policy rfq_quotes_read on rfq_quotes for select using (
  exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
          where e.id = rfq_quotes.event_id and m.user_id = auth.uid())
);
create policy rfq_quotes_write on rfq_quotes for all
  using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                 where e.id = rfq_quotes.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                      where e.id = rfq_quotes.event_id and m.user_id = auth.uid() and m.role <> 'viewer'));

create policy rfq_attachments_read on rfq_attachments for select using (
  exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
          where e.id = rfq_attachments.event_id and m.user_id = auth.uid())
);
create policy rfq_attachments_write on rfq_attachments for all
  using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                 where e.id = rfq_attachments.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                      where e.id = rfq_attachments.event_id and m.user_id = auth.uid() and m.role <> 'viewer'));

/* ----------------------------------------------------- org-scoped policies */

create policy supplier_contacts_read on supplier_contacts for select using (
  exists (select 1 from organisation_members m
          where m.org_id = supplier_contacts.org_id and m.user_id = auth.uid())
);
create policy supplier_contacts_write on supplier_contacts for all
  using (exists (select 1 from organisation_members m
                 where m.org_id = supplier_contacts.org_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from organisation_members m
                      where m.org_id = supplier_contacts.org_id and m.user_id = auth.uid() and m.role <> 'viewer'));

create policy supplier_documents_read on supplier_documents for select using (
  exists (select 1 from organisation_members m
          where m.org_id = supplier_documents.org_id and m.user_id = auth.uid())
);
create policy supplier_documents_write on supplier_documents for all
  using (exists (select 1 from organisation_members m
                 where m.org_id = supplier_documents.org_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from organisation_members m
                      where m.org_id = supplier_documents.org_id and m.user_id = auth.uid() and m.role <> 'viewer'));
