-- Advancer M1 — RLS, helper functions, cross-module FKs, bootstrap + seed.
-- Applied via Supabase MCP after the Drizzle-generated base schema.

/* ----------------------------------------------------------- helper functions */
-- SECURITY DEFINER so they bypass RLS on organisation_members/events and avoid
-- recursive policy evaluation. auth.uid() still resolves to the calling user.

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_writer(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid() and m.role <> 'viewer'
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

create or replace function public.can_access_event(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = ev and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_event(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = ev and m.user_id = auth.uid() and m.role <> 'viewer'
  );
$$;

create or replace function public.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members a
    join organisation_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

grant execute on function public.is_org_member(uuid), public.is_org_writer(uuid),
  public.is_org_admin(uuid), public.can_access_event(uuid),
  public.can_write_event(uuid), public.shares_org(uuid) to authenticated;

/* ---------------------------------------------------- new-user profile trigger */

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ---------------------------------------------------- first-user bootstrap RPC */
-- The first authenticated user claims ownership of the seeded Kyron org.
-- Once the org has any member, this is a no-op (further users must be invited).

create or replace function public.claim_kyron_owner()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select id into v_org from organisations where slug = 'kyron' limit 1;
  if v_org is null then return null; end if;
  if not exists (select 1 from organisation_members m where m.org_id = v_org) then
    insert into organisation_members (org_id, user_id, role)
    values (v_org, auth.uid(), 'owner')
    on conflict (org_id, user_id) do nothing;
  end if;
  return v_org;
end;
$$;

grant execute on function public.claim_kyron_owner() to authenticated;

/* -------------------------------------------------------- cross-module FKs */

alter table checklist_items
  add constraint checklist_items_budget_item_fk
    foreign key (budget_item_id) references budget_items(id) on delete set null,
  add constraint checklist_items_schedule_entry_fk
    foreign key (schedule_entry_id) references schedule_entries(id) on delete set null;

alter table schedule_entries
  add constraint schedule_entries_checklist_item_fk
    foreign key (checklist_item_id) references checklist_items(id) on delete set null,
  add constraint schedule_entries_budget_item_fk
    foreign key (budget_item_id) references budget_items(id) on delete set null;

/* ---------------------------------------------------------------- enable RLS */

alter table organisations            enable row level security;
alter table organisation_members     enable row level security;
alter table profiles                 enable row level security;
alter table clients                  enable row level security;
alter table venues                   enable row level security;
alter table suppliers                enable row level security;
alter table reference_values         enable row level security;
alter table events                   enable row level security;
alter table event_contacts           enable row level security;
alter table event_billing_profiles   enable row level security;
alter table event_site_maps          enable row level security;
alter table checklist_sections       enable row level security;
alter table checklist_items          enable row level security;
alter table checklist_item_status_history enable row level security;
alter table budget_versions          enable row level security;
alter table budget_categories        enable row level security;
alter table budget_items             enable row level security;
alter table schedule_entries         enable row level security;
alter table import_jobs              enable row level security;
alter table import_job_rows          enable row level security;
alter table audit_log                enable row level security;

/* -------------------------------------------------------- policies: identity */

create policy profiles_read on profiles for select
  using (id = auth.uid() or public.shares_org(id));
create policy profiles_write on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy org_read on organisations for select using (public.is_org_member(id));
create policy org_write on organisations for all
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy org_members_read on organisation_members for select
  using (public.is_org_member(org_id));
create policy org_members_write on organisation_members for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

/* -------------------------------------------------- policies: org-scoped tables */
-- read: any member; write: any non-viewer member.

create policy clients_read on clients for select using (public.is_org_member(org_id));
create policy clients_write on clients for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy venues_read on venues for select using (public.is_org_member(org_id));
create policy venues_write on venues for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy suppliers_read on suppliers for select using (public.is_org_member(org_id));
create policy suppliers_write on suppliers for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy reference_values_read on reference_values for select using (public.is_org_member(org_id));
create policy reference_values_write on reference_values for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy events_read on events for select using (public.is_org_member(org_id));
create policy events_write on events for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy import_jobs_read on import_jobs for select using (public.is_org_member(org_id));
create policy import_jobs_write on import_jobs for all
  using (public.is_org_writer(org_id)) with check (public.is_org_writer(org_id));

create policy import_job_rows_read on import_job_rows for select
  using (exists (select 1 from import_jobs j where j.id = job_id and public.is_org_member(j.org_id)));
create policy import_job_rows_write on import_job_rows for all
  using (exists (select 1 from import_jobs j where j.id = job_id and public.is_org_writer(j.org_id)))
  with check (exists (select 1 from import_jobs j where j.id = job_id and public.is_org_writer(j.org_id)));

-- audit log: members read; non-viewers insert; immutable (no update/delete policy).
create policy audit_log_read on audit_log for select using (public.is_org_member(org_id));
create policy audit_log_insert on audit_log for insert with check (public.is_org_writer(org_id));

/* ------------------------------------------------ policies: event-scoped tables */

create policy event_contacts_read on event_contacts for select using (public.can_access_event(event_id));
create policy event_contacts_write on event_contacts for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy event_billing_read on event_billing_profiles for select using (public.can_access_event(event_id));
create policy event_billing_write on event_billing_profiles for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy event_site_maps_read on event_site_maps for select using (public.can_access_event(event_id));
create policy event_site_maps_write on event_site_maps for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy checklist_sections_read on checklist_sections for select using (public.can_access_event(event_id));
create policy checklist_sections_write on checklist_sections for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy checklist_items_read on checklist_items for select using (public.can_access_event(event_id));
create policy checklist_items_write on checklist_items for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy checklist_history_read on checklist_item_status_history for select using (public.can_access_event(event_id));
create policy checklist_history_insert on checklist_item_status_history for insert
  with check (public.can_write_event(event_id));

create policy budget_versions_read on budget_versions for select using (public.can_access_event(event_id));
create policy budget_versions_write on budget_versions for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy budget_categories_read on budget_categories for select using (public.can_access_event(event_id));
create policy budget_categories_write on budget_categories for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy budget_items_read on budget_items for select using (public.can_access_event(event_id));
create policy budget_items_write on budget_items for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

create policy schedule_entries_read on schedule_entries for select using (public.can_access_event(event_id));
create policy schedule_entries_write on schedule_entries for all
  using (public.can_write_event(event_id)) with check (public.can_write_event(event_id));

/* ------------------------------------------------------------------- seed data */

insert into organisations (name, slug) values ('Kyron Pty Ltd', 'kyron')
on conflict (slug) do nothing;

do $$
declare v_org uuid;
begin
  select id into v_org from organisations where slug = 'kyron';
  if not exists (select 1 from reference_values r where r.org_id = v_org) then
    insert into reference_values (org_id, category, value, label, sort) values
      (v_org,'person','KB','Kyle Bailey (KB)',1),
      (v_org,'person','PHS','Fred (PHS)',2),
      (v_org,'person','FM','Frank M (FM)',3),
      (v_org,'person','VL','Wendy (VL)',4),
      (v_org,'person','TWA','Tyler (TWA)',5),
      (v_org,'person','MIZZICA','Mizzica',6),
      (v_org,'schedule_type','ON_SITE','On-site',1),
      (v_org,'schedule_type','INSTALL','Install',2),
      (v_org,'schedule_type','COLLECTION','Collection',3),
      (v_org,'schedule_type','DELIVERY','Delivery',4),
      (v_org,'schedule_type','SHOW_TIME','Show Time',5),
      (v_org,'schedule_type','BUMP_OUT','Bump Out',6),
      (v_org,'schedule_type','DROP_OFF','Drop Off',7),
      (v_org,'schedule_type','PICK_UP','Pick Up',8),
      (v_org,'schedule_type','SECURITY','Security',9),
      (v_org,'truck_type','ROBIAN','Robian',1),
      (v_org,'truck_type','HOKKER','Hokker',2);
    insert into reference_values (org_id, category, value, label, sort)
      select v_org, 'zone', chr(64 + g), 'Zone ' || chr(64 + g), g
      from generate_series(1, 17) g;  -- zones A..Q
  end if;
end $$;
