-- Advancer M2a — RFQ cross-module FKs + RLS.
-- RLS predicates are INLINED (not via the can_access_event/can_write_event
-- helpers) so these policies don't create a dependency on those functions —
-- a concurrent task is relocating them to a `private` schema. The inline
-- EXISTS resolves via the existing events / organisation_members RLS.

/* ----------------------------------------------------------- cross-module FKs */

alter table rfqs
  add constraint rfqs_awarded_recipient_fk
    foreign key (awarded_recipient_id) references rfq_recipients(id) on delete set null,
  add constraint rfqs_budget_item_fk
    foreign key (budget_item_id) references budget_items(id) on delete set null,
  add constraint rfqs_checklist_item_fk
    foreign key (checklist_item_id) references checklist_items(id) on delete set null;

/* ------------------------------------------------------------------ enable RLS */

alter table rfqs            enable row level security;
alter table rfq_items       enable row level security;
alter table rfq_recipients  enable row level security;

/* --------------------------------------------------------------------- policies */

create policy rfqs_read on rfqs for select using (
  exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = rfqs.event_id and m.user_id = auth.uid()
  )
);
create policy rfqs_write on rfqs for all
  using (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfqs.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  )
  with check (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfqs.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  );

create policy rfq_items_read on rfq_items for select using (
  exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = rfq_items.event_id and m.user_id = auth.uid()
  )
);
create policy rfq_items_write on rfq_items for all
  using (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfq_items.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  )
  with check (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfq_items.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  );

create policy rfq_recipients_read on rfq_recipients for select using (
  exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = rfq_recipients.event_id and m.user_id = auth.uid()
  )
);
create policy rfq_recipients_write on rfq_recipients for all
  using (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfq_recipients.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  )
  with check (
    exists (
      select 1 from events e
      join organisation_members m on m.org_id = e.org_id
      where e.id = rfq_recipients.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  );
