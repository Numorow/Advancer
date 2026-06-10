-- Advancer M16 — multi-user: photo avatars + email invites.
--
-- profiles.avatar_path: object path in the private `avatars` bucket (0012a).
-- org_invites: admin-issued email invites; the invitee signs up normally and
-- accept_pending_invites() (SECURITY DEFINER — same intentional family as
-- claim_kyron_owner/portal_payload) grants membership on their first request.

alter table profiles add column if not exists avatar_path text;

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  email text not null,
  role org_role not null default 'viewer',
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz
);
create index if not exists org_invites_org_idx on org_invites (org_id);
-- one OPEN invite per email per org
create unique index if not exists org_invites_open_email_idx
  on org_invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table org_invites enable row level security;

create policy org_invites_read on org_invites for select using (
  exists (select 1 from organisation_members m
          where m.org_id = org_invites.org_id and m.user_id = auth.uid())
);
create policy org_invites_write on org_invites for all
  using (exists (select 1 from organisation_members m
                 where m.org_id = org_invites.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin')))
  with check (exists (select 1 from organisation_members m
                      where m.org_id = org_invites.org_id and m.user_id = auth.uid()
                        and m.role in ('owner','admin')));

-- Grant membership for any open invites matching the caller's email.
create or replace function public.accept_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  accepted integer := 0;
  inv record;
begin
  select lower(email) into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return 0;
  end if;

  for inv in
    select * from org_invites
     where lower(email) = caller_email
       and accepted_at is null
       and revoked_at is null
  loop
    insert into organisation_members (org_id, user_id, role)
    values (inv.org_id, auth.uid(), inv.role)
    on conflict do nothing;

    update org_invites
       set accepted_at = now(), accepted_by = auth.uid()
     where id = inv.id;

    accepted := accepted + 1;
  end loop;

  return accepted;
end;
$$;

revoke all on function public.accept_pending_invites() from public;
grant execute on function public.accept_pending_invites() to authenticated;

-- anon must not see the RPC at all (it would just return 0, but keep it tight)
revoke execute on function public.accept_pending_invites() from anon;
