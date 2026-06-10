/**
 * Blank event template — the standard Kyron workbook skeleton applied to a new
 * event by "Create new event". Sections/items/categories/toilet types match
 * MASTER_WIP_TEMPLATE.xlsx, with all per-event values left blank/default.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { isManagementSection } from "@/lib/checklist/sync";

type DB = SupabaseClient<Database>;

export interface ChecklistSectionTemplate {
  name: string;
  items: string[];
}
export interface ToiletAreaTemplate {
  area: string;
  ratioTarget: number;
  types: string[];
}

export const BLANK_TEMPLATE = {
  checklistSections: [
    {
      // Items here mirror 1:1 into the Management module (see lib/checklist/sync.ts).
      name: "Management",
      items: [
        "Weekly WIP meeting",
        "Budget review",
        "Supplier RFQ follow-ups",
        "Permits & approvals",
        "Insurance certificates",
      ],
    },
    { name: "Portables (Buildings)", items: ["20ft Site Office", "20ft Bar container", "Ticket box (20ft)"] },
    { name: "Toilets", items: ["Portaloos (see toilet calculator)", "BOH Portaloos", "ADA Portaloos"] },
    {
      name: "Operations & Logistics",
      items: [
        "Event Application",
        "Transport Schedule",
        "Furniture Distro",
        "Production Schedule",
        "Build Schedule",
        "Event Management Plan",
        "Risk Management Plan",
        "Key Contacts List",
        "Site Map",
        "Liquor Licence",
        "Electrical Form 5",
        "Major Structures List / Engineering Sign-off",
      ],
    },
    { name: "Fencing", items: ["1.8m Fence", "White Picket Fence", "CCB", "Bollard & Rope", "Punter Barrier", "Scrim (Branded)"] },
    { name: "Structures", items: ["Marquee (3m x 3m)", "Marquees (6m x 3m)", "Scaffold centre structure", "Stage"] },
    { name: "Site & Turf Mitigation", items: ["Site Manager", "Site Crew", "Trakmatt", "Terratrak", "Ballast"] },
    { name: "Production & AV", items: ["Production Manager", "Audio", "Video", "Lighting", "Production Labour", "Truss"] },
    {
      name: "Power",
      items: ["60kva", "80kva", "55kva", "23kva", "7kva", "Generators", "Electricians", "Distro", "Festoon", "Cable Trap", "Site LX"],
    },
    { name: "Waste", items: ["Sulos (FOH)", "Cleaners", "Chain of Custody", "660L Sulos BOH"] },
    {
      name: "Site Furniture",
      items: ["1.8m Trestles", "2.4m Trestles", "Pippee Chairs", "Picnic Tables", "Round coffee tables", "Café Chairs"],
    },
    { name: "Theming / Décor", items: ["Plants & Greenery", "Awnings", "Wine Barrels", "Bunting", "Checkered Tablecloths"] },
    {
      name: "Safety",
      items: ["SWMS / Insurances", "Safety Officer", "JSA", "Safety Signage", "Emergency Evac Kit", "Fire Extinguishers"],
    },
    { name: "Machinery", items: ["2.5t All Terrain Forklift", "10D Scissor", "Tray Back Ute"] },
    { name: "Security", items: ["Asset Protection", "Security"] },
    { name: "Medical", items: ["First Aid", "First Aid Post"] },
  ] satisfies ChecklistSectionTemplate[],

  budgetCategories: [
    "Power / Electricians",
    "Portables",
    "Toilets",
    "Staging / AV",
    "Marquees / Structures",
    "Fencing",
    "Machinery",
    "Site & Turf Mitigation",
    "Furniture (Site / Patron)",
    "Theming / Décor",
    "Miscellaneous",
  ],

  toiletAreas: [
    { area: "General", ratioTarget: 75, types: ["16 Pan Block", "Urinal Block", "Single Chem", "ACROD"] },
    { area: "VIP", ratioTarget: 45, types: ["16 Pan Block", "Urinal Block", "Single Chem", "ACROD"] },
  ] satisfies ToiletAreaTemplate[],
};

/** Scaffold a freshly-created event with the blank workbook template. */
export async function applyBlankTemplate(supabase: DB, eventId: string): Promise<void> {
  // 1. Checklist sections + items
  const { data: sections, error: secErr } = await supabase
    .from("checklist_sections")
    .insert(BLANK_TEMPLATE.checklistSections.map((s, idx) => ({ event_id: eventId, name: s.name, sort: idx })))
    .select("id, name");
  if (secErr) throw new Error(`checklist_sections: ${secErr.message}`);
  const sectionId = new Map((sections ?? []).map((s) => [s.name, s.id]));

  const items = BLANK_TEMPLATE.checklistSections.flatMap((s) =>
    s.items.map((item, idx) => ({ section_id: sectionId.get(s.name)!, event_id: eventId, item, sort: idx })),
  );
  let insertedItems: { id: string; item: string; section_id: string }[] = [];
  if (items.length) {
    const { data, error } = await supabase
      .from("checklist_items")
      .insert(items)
      .select("id, item, section_id");
    if (error) throw new Error(`checklist_items: ${error.message}`);
    insertedItems = data ?? [];
  }

  // 1b. Management-section items mirror 1:1 into the Management module.
  const mgmtSection = (sections ?? []).find((s) => isManagementSection(s.name));
  if (mgmtSection) {
    for (const item of insertedItems.filter((i) => i.section_id === mgmtSection.id)) {
      const { data: task, error } = await supabase
        .from("management_tasks")
        .insert({ event_id: eventId, task: item.item })
        .select("id")
        .single();
      if (error || !task) throw new Error(`management_tasks: ${error?.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("checklist_items").update({ management_task_id: task.id } as any)).eq("id", item.id);
    }
  }

  // 2. Working budget version + categories
  const { data: version, error: verErr } = await supabase
    .from("budget_versions")
    .insert({ event_id: eventId, label: "Working budget", is_active: true })
    .select("id")
    .single();
  if (verErr || !version) throw new Error(`budget_versions: ${verErr?.message}`);
  const { error: catErr } = await supabase
    .from("budget_categories")
    .insert(BLANK_TEMPLATE.budgetCategories.map((name, idx) => ({ version_id: version.id, event_id: eventId, name, sort: idx })));
  if (catErr) throw new Error(`budget_categories: ${catErr.message}`);

  // 3. Toilet calculator rows (General + VIP)
  const toiletRows = BLANK_TEMPLATE.toiletAreas.flatMap((a) =>
    a.types.map((toilet_type, idx) => ({
      event_id: eventId,
      area: a.area,
      toilet_type,
      quantity: 0,
      pans: 0,
      capacity: null,
      ratio_target: a.ratioTarget,
      sort: idx,
    })),
  );
  if (toiletRows.length) {
    const { error } = await supabase.from("toilet_calculations").insert(toiletRows);
    if (error) throw new Error(`toilet_calculations: ${error.message}`);
  }
}
