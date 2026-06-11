-- Advancer M24 — Quotes & Invoices.
-- Supplier quote/invoice records against a budget line (kind = 'quote' | 'invoice').
-- Invoices feed the line's actual_inc_gst_cents + payment_status (lib/invoices/sync.ts);
-- quotes are stored reference only. Files live in the event-docs bucket. RLS +
-- realtime broadcast applied in the same file.

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  budget_item_id uuid references budget_items(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  kind text not null default 'invoice',
  reference text,
  issued_date date,
  due_date date,
  amount_inc_gst_cents integer,
  status text not null default 'received',
  file_path text,
  external_url text,
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists invoices_event_idx on invoices (event_id);
create index if not exists invoices_budget_item_idx on invoices (budget_item_id);

-- RLS — event-scoped read for members, write for non-viewer members (cf. 0003a).
do $$
begin
  execute 'alter table invoices enable row level security';
  execute $f$create policy invoices_read on invoices for select using (
    exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
            where e.id = invoices.event_id and m.user_id = auth.uid()))$f$;
  execute $f$create policy invoices_write on invoices for all
    using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
           where e.id = invoices.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
    with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
           where e.id = invoices.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))$f$;
end $$;

-- Realtime — poke the event topic on every write (function from 0013 is table-agnostic).
drop trigger if exists broadcast_change on invoices;
create trigger broadcast_change after insert or update or delete on invoices
  for each row execute function private.broadcast_event_change();
