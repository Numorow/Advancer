-- Advancer M20 — auth events into the audit log.
-- The app's audit trail covered data mutations only; sign-ups, sign-ins and
-- MFA enrolment were invisible. DB triggers on auth.* write them into
-- public.audit_log, so coverage is independent of app code paths.
--
-- audit_log.org_id is NOT NULL: events are attributed to the actor's org
-- membership, falling back to the first (single) organisation. Multi-org
-- would need a smarter attribution — fine today, this app is single-org.

create or replace function private.audit_auth_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  org uuid;
  act text;
  email text;
begin
  -- A failing trigger on auth.users would break every login — never throw.
  begin
    if tg_table_name = 'users' then
      uid := coalesce(new.id, old.id);
      email := coalesce(new.email, old.email);
      act := case when tg_op = 'INSERT' then 'auth:signup' else 'auth:signin' end;
    else -- auth.mfa_factors
      uid := coalesce(new.user_id, old.user_id);
      select u.email into email from auth.users u where u.id = uid;
      act := case when tg_op = 'DELETE' then 'auth:mfa_unenrolled' else 'auth:mfa_enrolled' end;
    end if;

    select m.org_id into org from public.organisation_members m where m.user_id = uid limit 1;
    if org is null then
      select o.id into org from public.organisations o order by o.created_at limit 1;
    end if;

    if org is not null then
      insert into public.audit_log (org_id, actor, entity, entity_id, action, after)
      values (org, uid, 'auth_user', uid, act, jsonb_build_object('email', email));
    end if;
  exception when others then
    null;
  end;
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_signup on auth.users;
create trigger audit_signup
  after insert on auth.users
  for each row execute function private.audit_auth_event();

drop trigger if exists audit_signin on auth.users;
create trigger audit_signin
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function private.audit_auth_event();

-- MFA lifecycle: a factor flipping to verified = enrolled; row removal =
-- unenrolled. (Trigger-based so viewer-role enrolees aren't blocked by the
-- is_org_writer RLS on app-side audit inserts.)
drop trigger if exists audit_mfa_enrolled on auth.mfa_factors;
create trigger audit_mfa_enrolled
  after update on auth.mfa_factors
  for each row
  when (old.status is distinct from new.status and new.status = 'verified')
  execute function private.audit_auth_event();

drop trigger if exists audit_mfa_unenrolled on auth.mfa_factors;
create trigger audit_mfa_unenrolled
  after delete on auth.mfa_factors
  for each row
  when (old.status = 'verified')
  execute function private.audit_auth_event();
