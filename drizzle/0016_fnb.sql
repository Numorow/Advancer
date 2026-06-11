-- Advancer M23 — Food & Beverage module.
-- Two event-scoped tables: fnb_vendors (line-up + site needs + compliance +
-- commercials) and fnb_catering_orders (crew catering). Vendors link to the
-- org-wide suppliers list. Income (site fees/bonds) lives here, not in the
-- cost-only budget. RLS + realtime broadcast applied in the same file.

create table if not exists fnb_vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  trading_name text,
  vendor_type text,
  location text,
  frontage_m numeric(8,2),
  power_req text,
  water boolean not null default false,
  waste boolean not null default false,
  arrival_date date,
  arrival_time time,
  licence_status text not null default 'missing',
  coi_status text not null default 'missing',
  permit_status text not null default 'missing',
  site_fee_cents integer,
  commission_pct numeric(5,2),
  bond_cents integer,
  payment_status text not null default 'unpaid',
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists fnb_vendors_event_idx on fnb_vendors (event_id);

create table if not exists fnb_catering_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  order_date date,
  meal text,
  headcount integer,
  dietary text,
  supplier_id uuid references suppliers(id) on delete set null,
  cost_cents integer,
  notes text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists fnb_catering_event_idx on fnb_catering_orders (event_id);

-- RLS — event-scoped read for members, write for non-viewer members (cf. 0003a).
do $$
declare t text;
begin
  foreach t in array array['fnb_vendors','fnb_catering_orders']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      $f$create policy %I on %I for select using (
        exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                where e.id = %I.event_id and m.user_id = auth.uid()))$f$,
      t || '_read', t, t);
    execute format(
      $f$create policy %I on %I for all
        using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
               where e.id = %I.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
        with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
               where e.id = %I.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))$f$,
      t || '_write', t, t, t);
  end loop;
end $$;

-- Realtime — poke the event topic on every write (function from 0013 is table-agnostic).
do $$
declare t text;
begin
  foreach t in array array['fnb_vendors','fnb_catering_orders']
  loop
    execute format('drop trigger if exists broadcast_change on %I', t);
    execute format(
      'create trigger broadcast_change after insert or update or delete on %I
         for each row execute function private.broadcast_event_change()', t);
  end loop;
end $$;
