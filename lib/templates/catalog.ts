/**
 * Event template catalogue — Blank, four Greenfield (outdoor) pax tiers and
 * three Venue types. Pure data + pure builders (client-safe): the new-event
 * form renders the picker from TEMPLATES and createEvent applies the choice
 * via applyEventTemplate. Greenfield tiers are built cumulatively so a bigger
 * tier always contains everything the smaller one does.
 *
 * Content is a domain-informed first cut — tune the specs below freely; the
 * catalog tests enforce structure (Management first, unique names, toilet
 * areas only General/VIP, tier monotonicity), not the exact item lists.
 */
import {
  BLANK_TEMPLATE,
  type ChecklistSectionTemplate,
  type TemplateContent,
  type ToiletAreaTemplate,
} from "./blank-event";

export type TemplateGroup = "Blank" | "Greenfield (Outdoors)" | "Venue";

export interface EventTemplate extends TemplateContent {
  /** Stable id — persisted in the audit log. */
  key: string;
  label: string;
  group: TemplateGroup;
  description: string;
}

export const DEFAULT_TEMPLATE_KEY = "blank";

interface TemplateSpec {
  key: string;
  label: string;
  group: TemplateGroup;
  description: string;
  /** Content to derive from (defaults to the blank skeleton). */
  base?: TemplateContent;
  /** Sections to drop, by exact name (must exist). */
  removeSections?: string[];
  /** Section -> full replacement item list (section must exist). */
  replaceItems?: Record<string, string[]>;
  /** Section -> items appended (section must exist; duplicates rejected). */
  addItems?: Record<string, string[]>;
  /** New sections, inserted before Security (or appended). Names must be new. */
  addSections?: ChecklistSectionTemplate[];
  /** Budget categories to drop, by exact name (must exist). */
  removeBudgetCategories?: string[];
  /** Budget categories appended (duplicates rejected). */
  extraBudgetCategories?: string[];
  /** Replaces the base toilet areas when provided (General/VIP only). */
  toiletAreas?: ToiletAreaTemplate[];
}

/** Derive a template from a base, failing loudly on typos (unknown/duplicate names). */
export function buildTemplate(spec: TemplateSpec): EventTemplate {
  const base = spec.base ?? BLANK_TEMPLATE;
  let sections: ChecklistSectionTemplate[] = base.checklistSections.map((s) => ({
    name: s.name,
    items: [...s.items],
  }));

  const sectionNames = () => new Set(sections.map((s) => s.name));

  for (const name of spec.removeSections ?? []) {
    if (!sectionNames().has(name)) throw new Error(`removeSections: unknown section "${name}"`);
    sections = sections.filter((s) => s.name !== name);
  }

  for (const [name, items] of Object.entries(spec.replaceItems ?? {})) {
    const section = sections.find((s) => s.name === name);
    if (!section) throw new Error(`replaceItems: unknown section "${name}"`);
    if (items.length === 0) throw new Error(`replaceItems: "${name}" must keep at least one item`);
    section.items = [...items];
  }

  for (const [name, items] of Object.entries(spec.addItems ?? {})) {
    const section = sections.find((s) => s.name === name);
    if (!section) throw new Error(`addItems: unknown section "${name}"`);
    for (const item of items) {
      if (section.items.some((i) => i.toLowerCase() === item.toLowerCase())) {
        throw new Error(`addItems: "${item}" already exists in "${name}"`);
      }
      section.items.push(item);
    }
  }

  for (const add of spec.addSections ?? []) {
    if (sectionNames().has(add.name)) throw new Error(`addSections: "${add.name}" already exists`);
    if (add.items.length === 0) throw new Error(`addSections: "${add.name}" needs at least one item`);
    const securityIdx = sections.findIndex((s) => s.name === "Security");
    const copy = { name: add.name, items: [...add.items] };
    if (securityIdx === -1) sections.push(copy);
    else sections.splice(securityIdx, 0, copy);
  }

  let budgetCategories = [...base.budgetCategories];
  for (const name of spec.removeBudgetCategories ?? []) {
    if (!budgetCategories.includes(name)) throw new Error(`removeBudgetCategories: unknown category "${name}"`);
    budgetCategories = budgetCategories.filter((c) => c !== name);
  }
  for (const name of spec.extraBudgetCategories ?? []) {
    if (budgetCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      throw new Error(`extraBudgetCategories: "${name}" already exists`);
    }
    budgetCategories.push(name);
  }

  return {
    key: spec.key,
    label: spec.label,
    group: spec.group,
    description: spec.description,
    checklistSections: sections,
    budgetCategories,
    toiletAreas: (spec.toiletAreas ?? base.toiletAreas).map((a) => ({ ...a, types: [...a.types] })),
  };
}

/* ------------------------------------------------------------------ blank */

const blank = buildTemplate({
  key: DEFAULT_TEMPLATE_KEY,
  label: "Blank workbook",
  group: "Blank",
  description: "The standard Kyron workbook skeleton — every section, nothing pre-scaled.",
});

/* ------------------------------------------- greenfield tiers (cumulative) */

const greenfield5k = buildTemplate({
  key: "greenfield-0-5k",
  label: "Greenfield — up to 5,000 pax",
  group: "Greenfield (Outdoors)",
  description: "Full outdoor build on a bare site: power, toilets, fencing, structures and waste.",
});

const greenfield10k = buildTemplate({
  key: "greenfield-5-10k",
  label: "Greenfield — 5,000 to 10,000 pax",
  group: "Greenfield (Outdoors)",
  description: "Adds traffic & crowd management, overnight security, ambulance standby and bigger power.",
  base: greenfield5k,
  addItems: {
    Power: ["100kva", "Tower Lights"],
    "Operations & Logistics": ["Traffic Management Plan"],
    Safety: ["Crowd Management Plan"],
    Security: ["Overnight Security"],
    Medical: ["Ambulance Standby"],
    Waste: ["Skip Bins (BOH)"],
  },
});

const greenfield20k = buildTemplate({
  key: "greenfield-10-20k",
  label: "Greenfield — 10,000 to 20,000 pax",
  group: "Greenfield (Outdoors)",
  description: "Adds water & plumbing, dust suppression, premium toilets and emergency services briefing.",
  base: greenfield10k,
  addSections: [
    { name: "Water & Plumbing", items: ["Potable Water Supply", "Water Refill Stations", "Plumber"] },
  ],
  addItems: {
    "Site & Turf Mitigation": ["Water Cart / Dust Suppression"],
    Toilets: ["Toilet Trailer (Premium)"],
    "Operations & Logistics": ["Emergency Services Briefing"],
  },
  extraBudgetCategories: ["Water & Plumbing", "Security & Medical", "Waste & Cleaning"],
});

const greenfield20kPlus = buildTemplate({
  key: "greenfield-20k-plus",
  label: "Greenfield — 20,000+ pax",
  group: "Greenfield (Outdoors)",
  description: "Major-event posture: event control centre, radio comms, CCTV, field medical and spotters.",
  base: greenfield20k,
  addItems: {
    Management: ["Authority / Stakeholder Meetings"],
    "Operations & Logistics": ["Event Control Centre", "Radio Comms Fleet", "CCTV"],
    Medical: ["Field Medical Post"],
    Security: ["Crowd Monitoring / Spotters"],
    Machinery: ["Telehandler"],
  },
});

/* ----------------------------------------------------------- venue types */

const venueClub = buildTemplate({
  key: "venue-club",
  label: "Venue — Club",
  group: "Venue",
  description: "House infrastructure venue: tie into house power, AV-heavy, no toilets/fencing build.",
  removeSections: ["Toilets", "Portables (Buildings)", "Site & Turf Mitigation", "Fencing", "Machinery"],
  replaceItems: {
    Power: ["House Power Tie-in", "Venue Electrician", "Distro", "Cable Trap"],
  },
  addItems: {
    "Production & AV": ["Rigging", "Venue Tech Liaison"],
    "Operations & Logistics": ["Venue Induction", "Loading Dock Schedule"],
  },
  removeBudgetCategories: [
    "Power / Electricians",
    "Portables",
    "Toilets",
    "Marquees / Structures",
    "Fencing",
    "Machinery",
    "Site & Turf Mitigation",
  ],
  extraBudgetCategories: ["Security", "Venue Services", "Transport / Logistics"],
  toiletAreas: [],
});

const venueArena = buildTemplate({
  key: "venue-arena",
  label: "Venue — Arena",
  group: "Venue",
  description: "Arena bump-in: rigging & motors, follow spots, dock bookings and screening.",
  base: venueClub,
  addSections: [{ name: "Machinery", items: ["Forklift (venue approved)"] }],
  addItems: {
    "Production & AV": ["Rigging / Motors", "Follow Spots"],
    Security: ["Bag Check / Screening"],
    "Operations & Logistics": ["Bump-in Dock Bookings"],
  },
  extraBudgetCategories: ["Machinery"],
});

const venueStadium = buildTemplate({
  key: "venue-stadium",
  label: "Venue — Stadium",
  group: "Venue",
  description: "Stadium-scale: turf protection, field access routes, precinct traffic and carts.",
  base: venueArena,
  addSections: [
    { name: "Site & Turf Mitigation", items: ["Turf Protection (Terraplas)", "Field Access Routes"] },
  ],
  addItems: {
    "Operations & Logistics": ["Precinct Traffic Plan"],
    Machinery: ["Buggies / Carts"],
  },
  extraBudgetCategories: ["Site & Turf Mitigation"],
});

/* ----------------------------------------------------------------- export */

export const TEMPLATES: EventTemplate[] = [
  blank,
  greenfield5k,
  greenfield10k,
  greenfield20k,
  greenfield20kPlus,
  venueClub,
  venueArena,
  venueStadium,
];

const BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

export function getTemplate(key: string): EventTemplate | undefined {
  return BY_KEY.get(key);
}
