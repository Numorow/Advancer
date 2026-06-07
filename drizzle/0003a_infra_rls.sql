-- Advancer M2c — infrastructure RLS. Event-scoped inline predicates (consistent
-- with RFQ/Crew), applied in a loop over the seven register tables.
do $$
declare t text;
begin
  foreach t in array array[
    'power_requirements','structures','fencing_requirements','furniture_distribution',
    'transport_movements','production_items','toilet_calculations'
  ]
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
