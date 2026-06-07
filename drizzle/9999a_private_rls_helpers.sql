-- Advancer — move RLS helper functions into a `private` schema.
-- Applied via Supabase MCP after 9999_rls_and_seed.sql.
--
-- Clears the security advisor warning `authenticated_security_definer_function_executable`.
-- The six SECURITY DEFINER helpers below are used ONLY inside RLS policies, never
-- called by the app. While they lived in `public` they were exposed as PostgREST
-- RPCs and flagged as executable by the `authenticated` role. PostgREST does not
-- expose the `private` schema, so moving them there removes the exposure.
--
-- claim_kyron_owner() stays in `public` (the app calls it via supabase.rpc) and is
-- intentionally left untouched.
--
-- Bodies are byte-for-byte identical to the originals: language sql, stable,
-- security definer, set search_path = public. search_path = public means the
-- unqualified table references (organisation_members, events) resolve to the
-- public tables even though the function now lives in `private`. auth.uid() still
-- resolves to the calling user.

/* ------------------------------------------------------------- private schema */

create schema if not exists private;

/* ------------------------------------------------ helper functions (private) */

create or replace function private.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_org_writer(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid() and m.role <> 'viewer'
  );
$$;

create or replace function private.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members m
    where m.org_id = org and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

create or replace function private.can_access_event(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = ev and m.user_id = auth.uid()
  );
$$;

create or replace function private.can_write_event(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    join organisation_members m on m.org_id = e.org_id
    where e.id = ev and m.user_id = auth.uid() and m.role <> 'viewer'
  );
$$;

create or replace function private.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisation_members a
    join organisation_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

/* ----------------------------------------------------------------- grants */
-- `private` is not in PostgREST's exposed schemas, so usage on the schema is
-- required for the RLS evaluator (running as the authenticated role) to call
-- these. They remain unreachable as RPCs.

grant usage on schema private to authenticated;

grant execute on function private.is_org_member(uuid), private.is_org_writer(uuid),
  private.is_org_admin(uuid), private.can_access_event(uuid),
  private.can_write_event(uuid), private.shares_org(uuid) to authenticated;

/* ------------------------------------------ re-point policies at private.* */
-- Every policy that referenced a public.<helper> is dropped and recreated to
-- reference private.<helper>. profiles_write is the only helper-free policy and
-- is intentionally not touched. Recreating these removes the dependency that
-- would otherwise block dropping the public.<helper> functions below.

-- identity
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using (id = auth.uid() or private.shares_org(id));

drop policy if exists org_read on organisations;
create policy org_read on organisations for select using (private.is_org_member(id));
drop policy if exists org_write on organisations;
create policy org_write on organisations for all
  using (private.is_org_admin(id)) with check (private.is_org_admin(id));

drop policy if exists org_members_read on organisation_members;
create policy org_members_read on organisation_members for select
  using (private.is_org_member(org_id));
drop policy if exists org_members_write on organisation_members;
create policy org_members_write on organisation_members for all
  using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));

-- org-scoped tables
drop policy if exists clients_read on clients;
create policy clients_read on clients for select using (private.is_org_member(org_id));
drop policy if exists clients_write on clients;
create policy clients_write on clients for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists venues_read on venues;
create policy venues_read on venues for select using (private.is_org_member(org_id));
drop policy if exists venues_write on venues;
create policy venues_write on venues for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists suppliers_read on suppliers;
create policy suppliers_read on suppliers for select using (private.is_org_member(org_id));
drop policy if exists suppliers_write on suppliers;
create policy suppliers_write on suppliers for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists reference_values_read on reference_values;
create policy reference_values_read on reference_values for select using (private.is_org_member(org_id));
drop policy if exists reference_values_write on reference_values;
create policy reference_values_write on reference_values for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists events_read on events;
create policy events_read on events for select using (private.is_org_member(org_id));
drop policy if exists events_write on events;
create policy events_write on events for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists import_jobs_read on import_jobs;
create policy import_jobs_read on import_jobs for select using (private.is_org_member(org_id));
drop policy if exists import_jobs_write on import_jobs;
create policy import_jobs_write on import_jobs for all
  using (private.is_org_writer(org_id)) with check (private.is_org_writer(org_id));

drop policy if exists import_job_rows_read on import_job_rows;
create policy import_job_rows_read on import_job_rows for select
  using (exists (select 1 from import_jobs j where j.id = job_id and private.is_org_member(j.org_id)));
drop policy if exists import_job_rows_write on import_job_rows;
create policy import_job_rows_write on import_job_rows for all
  using (exists (select 1 from import_jobs j where j.id = job_id and private.is_org_writer(j.org_id)))
  with check (exists (select 1 from import_jobs j where j.id = job_id and private.is_org_writer(j.org_id)));

drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log for select using (private.is_org_member(org_id));
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log for insert with check (private.is_org_writer(org_id));

-- event-scoped tables
drop policy if exists event_contacts_read on event_contacts;
create policy event_contacts_read on event_contacts for select using (private.can_access_event(event_id));
drop policy if exists event_contacts_write on event_contacts;
create policy event_contacts_write on event_contacts for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists event_billing_read on event_billing_profiles;
create policy event_billing_read on event_billing_profiles for select using (private.can_access_event(event_id));
drop policy if exists event_billing_write on event_billing_profiles;
create policy event_billing_write on event_billing_profiles for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists event_site_maps_read on event_site_maps;
create policy event_site_maps_read on event_site_maps for select using (private.can_access_event(event_id));
drop policy if exists event_site_maps_write on event_site_maps;
create policy event_site_maps_write on event_site_maps for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists checklist_sections_read on checklist_sections;
create policy checklist_sections_read on checklist_sections for select using (private.can_access_event(event_id));
drop policy if exists checklist_sections_write on checklist_sections;
create policy checklist_sections_write on checklist_sections for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists checklist_items_read on checklist_items;
create policy checklist_items_read on checklist_items for select using (private.can_access_event(event_id));
drop policy if exists checklist_items_write on checklist_items;
create policy checklist_items_write on checklist_items for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists checklist_history_read on checklist_item_status_history;
create policy checklist_history_read on checklist_item_status_history for select using (private.can_access_event(event_id));
drop policy if exists checklist_history_insert on checklist_item_status_history;
create policy checklist_history_insert on checklist_item_status_history for insert
  with check (private.can_write_event(event_id));

drop policy if exists budget_versions_read on budget_versions;
create policy budget_versions_read on budget_versions for select using (private.can_access_event(event_id));
drop policy if exists budget_versions_write on budget_versions;
create policy budget_versions_write on budget_versions for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists budget_categories_read on budget_categories;
create policy budget_categories_read on budget_categories for select using (private.can_access_event(event_id));
drop policy if exists budget_categories_write on budget_categories;
create policy budget_categories_write on budget_categories for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists budget_items_read on budget_items;
create policy budget_items_read on budget_items for select using (private.can_access_event(event_id));
drop policy if exists budget_items_write on budget_items;
create policy budget_items_write on budget_items for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

drop policy if exists schedule_entries_read on schedule_entries;
create policy schedule_entries_read on schedule_entries for select using (private.can_access_event(event_id));
drop policy if exists schedule_entries_write on schedule_entries;
create policy schedule_entries_write on schedule_entries for all
  using (private.can_write_event(event_id)) with check (private.can_write_event(event_id));

/* ---------------------------------------------- drop the public.<helper>s */
-- No policy references these any more (all recreated above). No CASCADE: if an
-- unexpected dependency remains, fail loudly rather than silently dropping it.

drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_writer(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.can_access_event(uuid);
drop function if exists public.can_write_event(uuid);
drop function if exists public.shares_org(uuid);
