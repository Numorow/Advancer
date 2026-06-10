import { formatCents } from "@/lib/calc/money";
import { rollupBudget, rollupByCategory, type BudgetLine } from "@/lib/calc/budget";
import { estimateTotals } from "@/lib/calc/estimate";
import { rollupCrew, shiftCostCents } from "@/lib/calc/crew";
import { rollupManagement, taskCostCents } from "@/lib/calc/management";
import { compareQuotes } from "@/lib/calc/rfq";
import { fencingTotalM, toiletAreaSummary } from "@/lib/calc/infra";
import { statusMeta } from "@/lib/status";
import type { DB, ReportColumn, ReportData, ReportDef } from "./types";

function cols(...defs: [string, ("right" | "center")?][]): ReportColumn[] {
  return defs.map(([label, align]) => ({ key: label, label, align }));
}
const num = (v: number | string | null): number => (v == null ? 0 : Number(v) || 0);

export const REPORTS: ReportDef[] = [
  {
    key: "budget-summary",
    title: "Budget summary",
    description: "Category rollups with GST and variance.",
    async build(supabase: DB, eventId: string): Promise<ReportData> {
      const { data } = await supabase
        .from("budget_items")
        .select("quoted_ex_gst_cents, actual_inc_gst_cents, approval_status, payment_status, budget_categories(name)")
        .eq("event_id", eventId)
        .is("deleted_at", null);
      const lines = (data ?? []).map((b) => ({
        quotedExGstCents: b.quoted_ex_gst_cents,
        actualIncGstCents: b.actual_inc_gst_cents,
        approvalStatus: b.approval_status,
        paymentStatus: b.payment_status,
        cat: (b.budget_categories as unknown as { name: string } | null)?.name ?? "Uncategorised",
      }));
      const groups = rollupByCategory(lines as (BudgetLine & { cat: string })[], (i) => i.cat);
      const grand = rollupBudget(lines);
      return {
        title: "Budget summary",
        columns: cols(["Category"], ["Quoted ex-GST", "right"], ["GST", "right"], ["Quoted inc-GST", "right"], ["Actual inc-GST", "right"], ["Variance", "right"]),
        rows: groups.map((g) => ({
          Category: g.key,
          "Quoted ex-GST": formatCents(g.rollup.quotedExGstCents),
          GST: formatCents(g.rollup.quotedGstCents),
          "Quoted inc-GST": formatCents(g.rollup.quotedIncGstCents),
          "Actual inc-GST": formatCents(g.rollup.actualIncGstCents),
          Variance: formatCents(g.rollup.varianceCents, { showSign: true }),
        })),
        totals: {
          Category: "TOTAL",
          "Quoted ex-GST": formatCents(grand.quotedExGstCents),
          GST: formatCents(grand.quotedGstCents),
          "Quoted inc-GST": formatCents(grand.quotedIncGstCents),
          "Actual inc-GST": formatCents(grand.actualIncGstCents),
          Variance: formatCents(grand.varianceCents, { showSign: true }),
        },
      };
    },
  },
  {
    key: "master-schedule",
    title: "Master schedule",
    description: "Every build/show/bump-out entry by date.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("schedule_entries")
        .select("event_date, start_time, finish_time, type, supplier_text, action, location, site_poc, completed, suppliers(name)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("event_date", { ascending: true })
        .order("sort", { ascending: true });
      return {
        title: "Master schedule",
        columns: cols(["Date"], ["Start"], ["Finish"], ["Type"], ["Supplier"], ["Action"], ["Location"], ["POC"], ["Done", "center"]),
        rows: (data ?? []).map((e) => ({
          Date: e.event_date ?? "",
          Start: e.start_time ? e.start_time.slice(0, 5) : "",
          Finish: e.finish_time ? e.finish_time.slice(0, 5) : "",
          Type: e.type ?? "",
          Supplier: (e.suppliers as unknown as { name: string } | null)?.name ?? e.supplier_text ?? "",
          Action: e.action ?? "",
          Location: e.location ?? "",
          POC: e.site_poc ?? "",
          Done: e.completed ? "✓" : "",
        })),
      };
    },
  },
  {
    key: "checklist",
    title: "Advancement checklist",
    description: "Full operations/logistics checklist with statuses.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("checklist_items")
        .select("item, details, responsible, rfq_status, booking_status, payment_status, status, checklist_sections(name), suppliers(name)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      return {
        title: "Advancement checklist",
        columns: cols(["Section"], ["Item"], ["Supplier"], ["Responsible"], ["RFQ"], ["Booking"], ["Payment"], ["Status"]),
        rows: (data ?? []).map((c) => ({
          Section: (c.checklist_sections as unknown as { name: string } | null)?.name ?? "",
          Item: c.item,
          Supplier: (c.suppliers as unknown as { name: string } | null)?.name ?? "",
          Responsible: c.responsible ?? "",
          RFQ: statusMeta("rfq_status", c.rfq_status).label,
          Booking: statusMeta("booking_status", c.booking_status).label,
          Payment: statusMeta("payment_status", c.payment_status).label,
          Status: statusMeta("status", c.status).label,
        })),
      };
    },
  },
  {
    key: "outstanding-actions",
    title: "Outstanding actions",
    description: "Items not yet RFQ'd, booked, or paid.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("checklist_items")
        .select("item, rfq_status, booking_status, payment_status, checklist_sections(name), suppliers(name)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      const rows = (data ?? [])
        .map((c) => {
          const issues: string[] = [];
          if (c.rfq_status === "not_sent") issues.push("RFQ not sent");
          if (c.booking_status === "not_booked") issues.push("Not booked");
          if (c.booking_status === "booked" && c.payment_status !== "paid") issues.push("Booked, unpaid");
          return { c, issues };
        })
        .filter((x) => x.issues.length > 0)
        .map(({ c, issues }) => ({
          Section: (c.checklist_sections as unknown as { name: string } | null)?.name ?? "",
          Item: c.item,
          Supplier: (c.suppliers as unknown as { name: string } | null)?.name ?? "",
          Outstanding: issues.join("; "),
        }));
      return {
        title: "Outstanding actions",
        subtitle: `${rows.length} items need attention`,
        columns: cols(["Section"], ["Item"], ["Supplier"], ["Outstanding"]),
        rows,
      };
    },
  },
  {
    key: "crew-cost",
    title: "Crew schedule & cost",
    description: "Shifts, hours and labour cost.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("crew_shifts")
        .select("shift_date, role_name, person, start_time, finish_time, scheduled_hours, actual_hours, rate_cents")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("shift_date", { ascending: true })
        .order("sort", { ascending: true });
      const lite = (data ?? []).map((s) => ({
        scheduledHours: num(s.scheduled_hours),
        actualHours: num(s.actual_hours),
        rateCents: s.rate_cents,
      }));
      const r = rollupCrew(lite);
      return {
        title: "Crew schedule & cost",
        columns: cols(["Date"], ["Role"], ["Person"], ["Start"], ["Finish"], ["Sched hrs", "right"], ["Actual hrs", "right"], ["Rate", "right"], ["Total", "right"]),
        rows: (data ?? []).map((s) => ({
          Date: s.shift_date ?? "",
          Role: s.role_name ?? "",
          Person: s.person ?? "",
          Start: s.start_time ? s.start_time.slice(0, 5) : "",
          Finish: s.finish_time ? s.finish_time.slice(0, 5) : "",
          "Sched hrs": num(s.scheduled_hours),
          "Actual hrs": num(s.actual_hours),
          Rate: s.rate_cents == null ? "" : formatCents(s.rate_cents),
          Total: formatCents(shiftCostCents({ actualHours: num(s.actual_hours), scheduledHours: num(s.scheduled_hours), rateCents: s.rate_cents })),
        })),
        totals: { Date: "TOTAL", Role: "", Person: "", Start: "", Finish: "", "Sched hrs": r.scheduledHours, "Actual hrs": r.actualHours, Rate: `inc-GST ${formatCents(r.incGstCents)}`, Total: formatCents(r.exGstCents) },
      };
    },
  },
  {
    key: "management-hours",
    title: "Management hours",
    description: "Weekly pre-event management plan and cost.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("management_tasks")
        .select("week_date, week_label, task, role, hours, rate_cents, completed")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("week_date", { ascending: true })
        .order("sort", { ascending: true });
      const r = rollupManagement((data ?? []).map((t) => ({ hours: num(t.hours), rateCents: t.rate_cents, completed: t.completed })));
      return {
        title: "Management hours",
        subtitle: `${r.completedTasks}/${r.tasks} tasks complete`,
        columns: cols(["Week"], ["Task"], ["Role"], ["Hours", "right"], ["Rate", "right"], ["Total", "right"], ["Done", "center"]),
        rows: (data ?? []).map((t) => ({
          Week: t.week_date ?? t.week_label ?? "",
          Task: t.task ?? "",
          Role: t.role ?? "",
          Hours: num(t.hours),
          Rate: t.rate_cents == null ? "" : formatCents(t.rate_cents),
          Total: formatCents(taskCostCents(num(t.hours), t.rate_cents)),
          Done: t.completed ? "✓" : "",
        })),
        totals: { Week: "TOTAL", Task: "", Role: "", Hours: r.hours, Rate: `inc-GST ${formatCents(r.incGstCents)}`, Total: formatCents(r.exGstCents), Done: "" },
      };
    },
  },
  {
    key: "rfq-status",
    title: "RFQ status",
    description: "RFQs, recipients and best quote.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("rfqs")
        .select("rfq_no, title, status, delivery_date, rfq_recipients(quoted_ex_gst_cents)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("rfq_no", { ascending: true });
      return {
        title: "RFQ status",
        columns: cols(["RFQ #"], ["Title"], ["Status"], ["Recipients", "right"], ["Best quote", "right"], ["Delivery"]),
        rows: (data ?? []).map((r) => {
          const recips = (r.rfq_recipients as unknown as { quoted_ex_gst_cents: number | null }[]) ?? [];
          const cmp = compareQuotes(recips.map((x) => ({ quotedExGstCents: x.quoted_ex_gst_cents })));
          return {
            "RFQ #": r.rfq_no ?? "",
            Title: r.title,
            Status: statusMeta("rfq_workflow", r.status).label,
            Recipients: recips.length,
            "Best quote": cmp.bestCents == null ? "" : formatCents(cmp.bestCents),
            Delivery: r.delivery_date ?? "",
          };
        }),
      };
    },
  },
  {
    key: "suppliers",
    title: "Supplier directory",
    description: "Organisation supplier directory.",
    async build(supabase, eventId) {
      // suppliers are org-level; scope by the event's org via membership/RLS (read returns the org's)
      void eventId;
      const { data } = await supabase
        .from("suppliers")
        .select("name, contact_name, email, phone, abn, insurance, preferred, service_categories")
        .is("deleted_at", null)
        .order("name", { ascending: true });
      return {
        title: "Supplier directory",
        columns: cols(["Name"], ["Contact"], ["Email"], ["Phone"], ["ABN"], ["Insurance", "center"], ["Preferred", "center"], ["Categories"]),
        rows: (data ?? []).map((s) => ({
          Name: s.name,
          Contact: s.contact_name ?? "",
          Email: s.email ?? "",
          Phone: s.phone ?? "",
          ABN: s.abn ?? "",
          Insurance: s.insurance ? "✓" : "",
          Preferred: s.preferred ? "✓" : "",
          Categories: (s.service_categories ?? []).join(", "),
        })),
      };
    },
  },
  {
    key: "documents",
    title: "Documents",
    description: "Event document register (files + links) with their associations.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("event_documents")
        .select("title, category, file_path, external_url, created_at, suppliers(name), rfqs(rfq_no, title)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return {
        title: "Documents",
        columns: cols(["Title"], ["Category"], ["Type", "center"], ["Linked to"], ["Added"]),
        rows: (data ?? []).map((d) => {
          const sup = (d.suppliers as unknown as { name: string } | null)?.name ?? null;
          const r = d.rfqs as unknown as { rfq_no: string | null; title: string } | null;
          const linked = [sup, r ? r.rfq_no ?? r.title : null].filter(Boolean).join(" · ");
          return {
            Title: d.title,
            Category: d.category ?? "",
            Type: d.file_path ? "file" : "link",
            "Linked to": linked,
            Added: (d.created_at ?? "").slice(0, 10),
          };
        }),
      };
    },
  },
  {
    key: "estimate",
    title: "Estimate",
    description: "High-level estimate vs quote by section, with GST totals.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("estimate_items")
        .select("section, description, estimate_ex_gst_cents, quote_ex_gst_cents, possible_reduction_cents, notes")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      const lines = (data ?? []).map((e) => ({
        section: e.section,
        description: e.description,
        estimateExGstCents: e.estimate_ex_gst_cents,
        quoteExGstCents: e.quote_ex_gst_cents,
        possibleReductionCents: e.possible_reduction_cents,
        notes: e.notes,
      }));
      const totals = estimateTotals(lines);
      return {
        title: "Estimate",
        columns: cols(["Section"], ["Item"], ["Estimate ex-GST", "right"], ["Quote ex-GST", "right"], ["Possible reduction", "right"], ["Notes"]),
        rows: lines.map((e) => ({
          Section: e.section,
          Item: e.description,
          "Estimate ex-GST": formatCents(e.estimateExGstCents),
          "Quote ex-GST": e.quoteExGstCents == null ? "" : formatCents(e.quoteExGstCents),
          "Possible reduction": e.possibleReductionCents == null ? "" : formatCents(e.possibleReductionCents),
          Notes: e.notes ?? "",
        })),
        totals: {
          Section: "TOTAL",
          Item: `inc GST ${formatCents(totals.estimateIncGstCents)} / quote inc GST ${formatCents(totals.quoteIncGstCents)}`,
          "Estimate ex-GST": formatCents(totals.estimateExGstCents),
          "Quote ex-GST": formatCents(totals.quoteExGstCents),
          "Possible reduction": totals.possibleReductionCents ? formatCents(totals.possibleReductionCents) : "",
          Notes: "",
        },
      };
    },
  },
  {
    key: "contacts",
    title: "Key contacts",
    description: "Stakeholder contacts for the event.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("event_contacts")
        .select("position, name, company, mobile, email")
        .eq("event_id", eventId)
        .order("sort", { ascending: true });
      return {
        title: "Key contacts",
        columns: cols(["Position / role"], ["Name"], ["Company"], ["Mobile"], ["Email"]),
        rows: (data ?? []).map((c) => ({
          "Position / role": c.position ?? "",
          Name: c.name ?? "",
          Company: c.company ?? "",
          Mobile: c.mobile ?? "",
          Email: c.email ?? "",
        })),
      };
    },
  },
  {
    key: "toilet-ratio",
    title: "Toilet ratio",
    description: "Pan counts and capacity ratio by area.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("toilet_calculations")
        .select("area, quantity, pans, capacity, ratio_target")
        .eq("event_id", eventId)
        .is("deleted_at", null);
      const areas = [...new Set((data ?? []).map((t) => t.area ?? "General"))];
      return {
        title: "Toilet ratio",
        columns: cols(["Area"], ["Total pans", "right"], ["Capacity", "right"], ["People / pan", "right"], ["Target", "right"], ["Result", "center"]),
        rows: areas.map((area) => {
          const lines = (data ?? []).filter((t) => (t.area ?? "General") === area);
          const cap = lines.map((l) => l.capacity).find((c) => c != null) ?? null;
          const tgt = lines.map((l) => l.ratio_target).find((c) => c != null) ?? null;
          const s = toiletAreaSummary(lines.map((l) => ({ quantity: l.quantity, pans: l.pans })), cap, tgt);
          return {
            Area: area,
            "Total pans": s.totalPans,
            Capacity: s.capacity ?? "",
            "People / pan": s.ratio == null ? "n/a" : Math.round(s.ratio * 10) / 10,
            Target: s.ratioTarget ?? "",
            Result: s.meetsTarget == null ? "" : s.meetsTarget ? "within target" : "over target",
          };
        }),
      };
    },
  },
  {
    key: "fencing",
    title: "Fencing requirements",
    description: "Fence runs with mitigation and totals.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("fencing_requirements")
        .select("fence_type, location, type, length_m, mitigation_m")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      const total = (data ?? []).reduce((a, f) => a + fencingTotalM(num(f.length_m), num(f.mitigation_m)), 0);
      return {
        title: "Fencing requirements",
        columns: cols(["Fence type"], ["Location"], ["Action"], ["Length (m)", "right"], ["Mitigation (m)", "right"], ["Total (m)", "right"]),
        rows: (data ?? []).map((f) => ({
          "Fence type": f.fence_type ?? "",
          Location: f.location ?? "",
          Action: f.type ?? "",
          "Length (m)": num(f.length_m),
          "Mitigation (m)": num(f.mitigation_m),
          "Total (m)": fencingTotalM(num(f.length_m), num(f.mitigation_m)),
        })),
        totals: { "Fence type": "TOTAL", Location: "", Action: "", "Length (m)": "", "Mitigation (m)": "", "Total (m)": Math.round(total * 100) / 100 },
      };
    },
  },
  {
    key: "power",
    title: "Power requirements",
    description: "Generators, distro and outlets.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("power_requirements")
        .select("category, item, quantity, location, delivery_date, collection_date")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      return {
        title: "Power requirements",
        columns: cols(["Category"], ["Item"], ["Qty", "right"], ["Location"], ["Delivery"], ["Collection"]),
        rows: (data ?? []).map((p) => ({
          Category: p.category ?? "",
          Item: p.item ?? "",
          Qty: p.quantity ?? "",
          Location: p.location ?? "",
          Delivery: p.delivery_date ?? "",
          Collection: p.collection_date ?? "",
        })),
      };
    },
  },
  {
    key: "structures",
    title: "Structures register",
    description: "Marquees and structures with sign-off.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("structures")
        .select("name, type, length_m, width_m, pegged, weighted, docs_received, engineer_signoff")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      return {
        title: "Structures register",
        columns: cols(["Name"], ["Type"], ["L (m)", "right"], ["W (m)", "right"], ["Pegged", "center"], ["Weighted", "center"], ["Docs", "center"], ["Eng. sign-off", "center"]),
        rows: (data ?? []).map((s) => ({
          Name: s.name ?? "",
          Type: s.type ?? "",
          "L (m)": num(s.length_m),
          "W (m)": num(s.width_m),
          Pegged: s.pegged ? "✓" : "",
          Weighted: s.weighted ? "✓" : "",
          Docs: s.docs_received ? "✓" : "",
          "Eng. sign-off": s.engineer_signoff ? "✓" : "",
        })),
      };
    },
  },
  {
    key: "furniture",
    title: "Furniture distribution",
    description: "Furniture quantities by location, asset and supplier.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("furniture_distribution")
        .select("location, asset, quantity, suppliers(name)")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("sort", { ascending: true });
      return {
        title: "Furniture distribution",
        columns: cols(["Location"], ["Asset"], ["Qty", "right"], ["Supplier"]),
        rows: (data ?? []).map((f) => ({
          Location: f.location ?? "",
          Asset: f.asset ?? "",
          Qty: f.quantity ?? "",
          Supplier: (f.suppliers as unknown as { name: string } | null)?.name ?? "",
        })),
      };
    },
  },
  {
    key: "transport",
    title: "Transport movements",
    description: "Incoming / outgoing logistics schedule.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("transport_movements")
        .select("direction, move_date, move_time, item, from_to, truck_type, doors_facing, gate_entry, contact_person")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("move_date", { ascending: true, nullsFirst: true })
        .order("sort", { ascending: true });
      return {
        title: "Transport movements",
        columns: cols(["Direction"], ["Date"], ["Time"], ["Item"], ["From / To"], ["Truck"], ["Doors"], ["Gate"], ["Contact"]),
        rows: (data ?? []).map((t) => ({
          Direction: t.direction ?? "",
          Date: t.move_date ?? "",
          Time: t.move_time ? String(t.move_time).slice(0, 5) : "",
          Item: t.item ?? "",
          "From / To": t.from_to ?? "",
          Truck: t.truck_type ?? "",
          Doors: t.doors_facing ?? "",
          Gate: t.gate_entry ?? "",
          Contact: t.contact_person ?? "",
        })),
      };
    },
  },
  {
    key: "production",
    title: "Production schedule",
    description: "Production activities by date.",
    async build(supabase, eventId) {
      const { data } = await supabase
        .from("production_items")
        .select("item_date, start_time, finish_time, activity, notes")
        .eq("event_id", eventId)
        .is("deleted_at", null)
        .order("item_date", { ascending: true, nullsFirst: true })
        .order("sort", { ascending: true });
      return {
        title: "Production schedule",
        columns: cols(["Date"], ["Start"], ["Finish"], ["Activity"], ["Notes"]),
        rows: (data ?? []).map((p) => ({
          Date: p.item_date ?? "",
          Start: p.start_time ? String(p.start_time).slice(0, 5) : "",
          Finish: p.finish_time ? String(p.finish_time).slice(0, 5) : "",
          Activity: p.activity ?? "",
          Notes: p.notes ?? "",
        })),
      };
    },
  },
];

const BY_KEY = new Map(REPORTS.map((r) => [r.key, r]));
export function getReport(key: string): ReportDef | undefined {
  return BY_KEY.get(key);
}
