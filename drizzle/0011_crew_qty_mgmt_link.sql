-- Advancer M15 — crew shift quantity + checklist→management mirror link.
--
-- quantity: "3× Site Crew" is one shift line; cost/hour rollups multiply by it.
-- management_task_id: items in a "Management" checklist section mirror 1:1 to
-- management_tasks (same linking style as checklist_items.budget_item_id).

alter table crew_shifts
  add column if not exists quantity integer not null default 1;

alter table checklist_items
  add column if not exists management_task_id uuid references management_tasks(id) on delete set null;
