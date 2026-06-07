-- Advancer M2b — crew RLS + seed roles.
-- RLS predicates inlined (consistent with the RFQ tables) to stay decoupled
-- from the helper-function relocation happening in a parallel task.

alter table crew_roles  enable row level security;
alter table crew_shifts enable row level security;

create policy crew_roles_read on crew_roles for select using (
  exists (select 1 from organisation_members m where m.org_id = crew_roles.org_id and m.user_id = auth.uid())
);
create policy crew_roles_write on crew_roles for all
  using (
    exists (select 1 from organisation_members m where m.org_id = crew_roles.org_id and m.user_id = auth.uid() and m.role <> 'viewer')
  )
  with check (
    exists (select 1 from organisation_members m where m.org_id = crew_roles.org_id and m.user_id = auth.uid() and m.role <> 'viewer')
  );

create policy crew_shifts_read on crew_shifts for select using (
  exists (
    select 1 from events e join organisation_members m on m.org_id = e.org_id
    where e.id = crew_shifts.event_id and m.user_id = auth.uid()
  )
);
create policy crew_shifts_write on crew_shifts for all
  using (
    exists (
      select 1 from events e join organisation_members m on m.org_id = e.org_id
      where e.id = crew_shifts.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  )
  with check (
    exists (
      select 1 from events e join organisation_members m on m.org_id = e.org_id
      where e.id = crew_shifts.event_id and m.user_id = auth.uid() and m.role <> 'viewer'
    )
  );

-- seed common roles for the Kyron org (idempotent)
do $$
declare v_org uuid;
begin
  select id into v_org from organisations where slug = 'kyron';
  if v_org is not null and not exists (select 1 from crew_roles r where r.org_id = v_org) then
    insert into crew_roles (org_id, name, default_rate_cents, sort) values
      (v_org, 'Site Manager', 11500, 1),
      (v_org, 'Project Manager', 11500, 2),
      (v_org, 'Site Crew', 6500, 3),
      (v_org, 'Fork Op', 6700, 4),
      (v_org, 'EWP Op', 6700, 5);
  end if;
end $$;
