-- Advancer M19 — realtime live updates.
-- Broadcast-from-database: every write to an event-scoped table pokes the
-- private Realtime topic `event:<event_id>`; clients in that event debounce a
-- router refresh. Chosen over postgres_changes so deletes/bulk imports/all
-- mutation paths are covered by one trigger, with no per-table publication or
-- per-subscriber RLS replay. Payload is a poke only (table/op/actor) — never
-- row data — so the realtime.messages policy is the only read gate.

create or replace function private.broadcast_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  eid text;
begin
  eid := case when tg_table_name = 'events' then rec->>'id' else rec->>'event_id' end;
  if eid is not null then
    begin
      perform realtime.send(
        jsonb_build_object('table', tg_table_name, 'op', tg_op, 'by', auth.uid()),
        'change',
        'event:' || eid,
        true);
    exception when others then
      null; -- a realtime hiccup must never fail the write itself
    end;
  end if;
  return coalesce(new, old);
end;
$$;

grant execute on function private.broadcast_event_change() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'events',
    'event_contacts','event_billing_profiles','event_site_maps','event_share_links',
    'checklist_sections','checklist_items',
    'budget_versions','budget_categories','budget_items',
    'estimate_items','schedule_entries',
    'rfqs','rfq_items','rfq_recipients','rfq_quotes','rfq_attachments',
    'event_documents','crew_shifts',
    'power_requirements','structures','fencing_requirements','furniture_distribution',
    'transport_movements','production_items','toilet_calculations',
    'management_tasks','site_notes'
  ]
  loop
    execute format('drop trigger if exists broadcast_change on %I', t);
    execute format(
      'create trigger broadcast_change after insert or update or delete on %I
         for each row execute function private.broadcast_event_change()', t);
  end loop;
end $$;

-- Receive gate: org members of the event may subscribe to its broadcast topic.
-- Evaluated at channel join (not per message); regex-guards the uuid cast so a
-- junk topic denies instead of erroring.
drop policy if exists event_broadcast_read on realtime.messages;
create policy event_broadcast_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 1) = 'event'
    and split_part(realtime.topic(), ':', 2)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.can_access_event((split_part(realtime.topic(), ':', 2))::uuid)
  );
