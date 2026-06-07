-- Advancer M3 — move the SECURITY DEFINER policy helpers out of `public` into a
-- `private` schema (not exposed by PostgREST). Clears the advisor warnings
-- `*_security_definer_function_executable`.
--
-- No policy rewrite needed: RLS policies depend on these functions by OID, so
-- ALTER FUNCTION ... SET SCHEMA moves them with their dependencies intact. Each
-- function keeps `SET search_path = public`, so its internal organisation_members
-- / events references still resolve. EXECUTE grants travel with the function;
-- authenticated additionally needs USAGE on the new schema. anon gets no USAGE,
-- so it cannot call them. claim_kyron_owner stays in public (it is the app RPC).

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_org_member(uuid)   set schema private;
alter function public.is_org_writer(uuid)    set schema private;
alter function public.is_org_admin(uuid)     set schema private;
alter function public.can_access_event(uuid) set schema private;
alter function public.can_write_event(uuid)  set schema private;
alter function public.shares_org(uuid)       set schema private;
