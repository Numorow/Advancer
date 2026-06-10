/**
 * Row builders mapping parsed infrastructure / management data to DB insert
 * shapes. Shared by the import commit (lib/import/commit.ts) and the per-module
 * "import from workbook" backfill actions.
 */
import type { ParsedEstimateItem, ParsedInfrastructure, ParsedManagementTask } from "./types";

export interface InfraTableRows {
  table: string;
  rows: Record<string, unknown>[];
}

export function buildInfraTables(eventId: string, infra: ParsedInfrastructure): InfraTableRows[] {
  return [
    {
      table: "power_requirements",
      rows: infra.power.map((p, idx) => ({
        event_id: eventId,
        category: p.category ?? null,
        item: p.item ?? null,
        quantity: p.quantity,
        location: p.location ?? null,
        delivery_date: p.deliveryDate,
        collection_date: p.collectionDate,
        sort: idx,
      })),
    },
    {
      table: "structures",
      rows: infra.structures.map((s, idx) => ({
        event_id: eventId,
        name: s.name ?? null,
        type: s.type ?? null,
        responsible: s.responsible ?? null,
        length_m: s.lengthM,
        width_m: s.widthM,
        pegged: s.pegged,
        weighted: s.weighted,
        lighting: s.lighting,
        walls: s.walls ?? null,
        docs_received: s.docsReceived,
        engineer_signoff: s.engineerSignoff,
        link: s.link ?? null,
        notes: s.notes ?? null,
        sort: idx,
      })),
    },
    {
      table: "fencing_requirements",
      rows: infra.fencing.map((f, idx) => ({
        event_id: eventId,
        fence_type: f.fenceType ?? null,
        location: f.location ?? null,
        type: f.type ?? null,
        length_m: f.lengthM,
        mitigation_m: f.mitigationM,
        notes: f.notes ?? null,
        sort: idx,
      })),
    },
    {
      table: "furniture_distribution",
      rows: infra.furniture.map((f, idx) => ({
        event_id: eventId,
        location: f.location ?? null,
        asset: f.asset ?? null,
        quantity: f.quantity,
        sort: idx,
      })),
    },
    {
      table: "toilet_calculations",
      rows: infra.toilets.map((t, idx) => ({
        event_id: eventId,
        area: t.area,
        toilet_type: t.toiletType ?? null,
        quantity: t.quantity,
        pans: t.pans,
        capacity: t.capacity,
        ratio_target: t.ratioTarget,
        sort: idx,
      })),
    },
    {
      table: "transport_movements",
      rows: infra.transport.map((t, idx) => ({
        event_id: eventId,
        direction: t.direction ?? null,
        move_date: t.moveDate,
        move_time: t.moveTime,
        item: t.item ?? null,
        from_to: t.fromTo ?? null,
        truck_type: t.truckType ?? null,
        doors_facing: t.doorsFacing ?? null,
        gate_entry: t.gateEntry ?? null,
        contact_person: t.contactPerson ?? null,
        sort: idx,
      })),
    },
    {
      table: "production_items",
      rows: infra.production.map((p, idx) => ({
        event_id: eventId,
        item_date: p.itemDate,
        start_time: p.startTime,
        finish_time: p.finishTime,
        activity: p.activity ?? null,
        notes: p.notes ?? null,
        sort: idx,
      })),
    },
  ];
}

export function buildManagementRows(
  eventId: string,
  tasks: ParsedManagementTask[],
): Record<string, unknown>[] {
  return tasks.map((m, idx) => ({
    event_id: eventId,
    week_date: m.weekDate,
    week_label: m.weekLabel ?? null,
    task_no: m.taskNo,
    task: m.task ?? null,
    hours: m.hours,
    completed: m.completed,
    role: m.role ?? null,
    rate_cents: m.rateCents,
    sort: idx,
  }));
}

export function buildEstimateRows(
  eventId: string,
  items: ParsedEstimateItem[],
): Record<string, unknown>[] {
  return items.map((e, idx) => ({
    event_id: eventId,
    section: e.section,
    description: e.description,
    estimate_ex_gst_cents: e.estimateExGstCents ?? 0,
    quote_ex_gst_cents: e.quoteExGstCents,
    notes: e.notes ?? null,
    sort: idx,
  }));
}
