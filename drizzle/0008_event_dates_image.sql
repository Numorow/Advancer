-- Advancer M9 — editable event phase ranges + cover image + schedule auto marker.
-- Additive columns only; no RLS change (events/schedule_entries policies already exist).

alter table events
  add column if not exists bump_in_start  date,
  add column if not exists bump_in_end    date,
  add column if not exists event_start    date,
  add column if not exists event_end      date,
  add column if not exists bump_out_start date,
  add column if not exists bump_out_end   date,
  add column if not exists image_path     text;

alter table schedule_entries
  add column if not exists auto_generated boolean not null default false;
