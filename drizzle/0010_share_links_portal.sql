-- Advancer M13 — tokenised read-only portals (client/venue + supplier).
--
-- event_share_links holds revocable, optionally-expiring share tokens. In-app
-- management is covered by inline-EXISTS RLS like 0006/0007/0009. The public
-- portal page reads through portal_payload(token) below — a SECURITY DEFINER
-- RPC (the same intentional pattern as claim_kyron_owner) so no service-role
-- key is needed anywhere; anon gets exactly the fields the function exposes,
-- never table access.

create table if not exists event_share_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kind text not null check (kind in ('client', 'supplier')),
  supplier_id uuid references suppliers(id) on delete cascade,
  token text not null unique,
  label text,
  created_by uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint share_link_supplier_kind check (kind <> 'supplier' or supplier_id is not null)
);
create index if not exists event_share_links_event_idx on event_share_links (event_id);

alter table event_share_links enable row level security;

create policy event_share_links_read on event_share_links for select using (
  exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
          where e.id = event_share_links.event_id and m.user_id = auth.uid())
);
create policy event_share_links_write on event_share_links for all
  using (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                 where e.id = event_share_links.event_id and m.user_id = auth.uid() and m.role <> 'viewer'))
  with check (exists (select 1 from events e join organisation_members m on m.org_id = e.org_id
                      where e.id = event_share_links.event_id and m.user_id = auth.uid() and m.role <> 'viewer'));

-- The portal read model. Client links see the schedule (no internal notes or
-- site POC), key contacts, site maps and progress counts — no budget, no
-- documents. Supplier links see only their own RFQs (never other suppliers'
-- pricing) and their own schedule entries.
create or replace function public.portal_payload(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l event_share_links%rowtype;
  ev events%rowtype;
  payload jsonb;
begin
  select * into l from event_share_links
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;

  select * into ev from events where id = l.event_id and deleted_at is null;
  if not found then
    return null;
  end if;

  payload := jsonb_build_object(
    'kind', l.kind,
    'label', l.label,
    'event', jsonb_build_object('name', ev.name, 'startDate', ev.start_date, 'endDate', ev.end_date),
    'contacts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'position', c.position, 'name', c.name, 'company', c.company,
        'mobile', c.mobile, 'email', c.email) order by c.sort), '[]'::jsonb)
      from event_contacts c where c.event_id = l.event_id
    )
  );

  if l.kind = 'client' then
    payload := payload || jsonb_build_object(
      'progress', (
        select jsonb_build_object(
          'checklistTotal', count(*),
          'checklistDone', count(*) filter (where status = 'done'))
        from checklist_items where event_id = l.event_id and deleted_at is null
      ),
      'scheduleProgress', (
        select jsonb_build_object(
          'total', count(*),
          'done', count(*) filter (where completed),
          'criticalOpen', count(*) filter (where critical_path and not completed))
        from schedule_entries where event_id = l.event_id and deleted_at is null
      ),
      'schedule', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'date', se.event_date, 'start', se.start_time, 'finish', se.finish_time,
          'type', se.type, 'action', se.action, 'location', se.location,
          'supplier', coalesce(s.name, se.supplier_text), 'completed', se.completed)
          order by se.event_date asc nulls last, se.sort asc), '[]'::jsonb)
        from schedule_entries se
        left join suppliers s on s.id = se.supplier_id
        where se.event_id = l.event_id and se.deleted_at is null
      ),
      'siteMaps', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'version', m.version, 'label', m.label, 'url', m.url) order by m.created_at), '[]'::jsonb)
        from event_site_maps m where m.event_id = l.event_id
      )
    );
  else
    payload := payload || jsonb_build_object(
      'supplier', (select jsonb_build_object('name', s.name) from suppliers s where s.id = l.supplier_id),
      'rfqs', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'rfqNo', r.rfq_no, 'title', r.title, 'status', r.status::text,
          'recipientStatus', rr.status::text,
          'deliveryDate', r.delivery_date, 'collectionDate', r.collection_date,
          'responseDue', r.response_due_date, 'location', r.location, 'notes', r.notes,
          'items', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'description', i.description, 'quantity', i.quantity, 'unit', i.unit)
              order by i.sort), '[]'::jsonb)
            from rfq_items i where i.rfq_id = r.id
          )) order by r.created_at desc), '[]'::jsonb)
        from rfq_recipients rr
        join rfqs r on r.id = rr.rfq_id
        where rr.supplier_id = l.supplier_id
          and r.event_id = l.event_id
          and r.deleted_at is null
      ),
      'schedule', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'date', se.event_date, 'start', se.start_time, 'finish', se.finish_time,
          'type', se.type, 'action', se.action, 'location', se.location,
          'sitePoc', se.site_poc, 'completed', se.completed)
          order by se.event_date asc nulls last, se.sort asc), '[]'::jsonb)
        from schedule_entries se
        where se.event_id = l.event_id and se.supplier_id = l.supplier_id and se.deleted_at is null
      )
    );
  end if;

  return payload;
end;
$$;

revoke all on function public.portal_payload(text) from public;
grant execute on function public.portal_payload(text) to anon, authenticated;
