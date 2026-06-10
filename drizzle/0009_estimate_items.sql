-- Advancer M12 — high-level estimate lines (the workbook ESTIMATE sheet).
-- Coarser than the detailed budget; the Estimate page compares these against
-- budget quoted/actual totals. Amounts are ex-GST integer cents.
-- RLS uses the INLINE event predicate (helpers live in private), matching 0006/0007.

create table if not exists estimate_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  section text not null,
  description text not null,
  estimate_ex_gst_cents integer not null default 0,
  quote_ex_gst_cents integer,
  possible_reduction_cents integer,
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists estimate_items_event_idx on estimate_items (event_id);

alter table estimate_items enable row level security;

create policy estimate_items_read on estimate_items for select using (
  exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
          where e.id = estimate_items.event_id and m.user_id = auth.uid())
);
create policy estimate_items_write on estimate_items for all
  using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                 where e.id = estimate_items.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                      where e.id = estimate_items.event_id and m.user_id = auth.uid() and m.role <> 'viewer'));
