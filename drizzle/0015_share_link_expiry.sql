-- Advancer M20 — share links default to a 90-day expiry.
-- Portal tokens were indefinite unless someone remembered to set an expiry;
-- compliance-wise an unbounded read token to event data is a liability.
-- The app now passes an explicit expiry on create; this default is the
-- belt-and-braces for any other insert path, and the backfill closes out the
-- existing open-ended links.

alter table event_share_links
  alter column expires_at set default (now() + interval '90 days');

update event_share_links
  set expires_at = now() + interval '90 days'
  where expires_at is null and revoked_at is null;
