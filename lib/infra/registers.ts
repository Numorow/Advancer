/**
 * Infrastructure register definitions — shared by the generic RegisterGrid UI
 * and the generic server actions. Each register maps a URL slug to a DB table
 * and a typed column list. Field types drive both the cell editors and the
 * server-side coercion/validation.
 */
export type ColType =
  | "text"
  | "num"
  | "int"
  | "bool"
  | "date"
  | "time"
  | "select"
  | "supplier";

export interface Column {
  key: string;
  label: string;
  type: ColType;
  options?: string[];
  align?: "right" | "center";
  width?: string;
}

export interface ComputedColumn {
  key: string;
  label: string;
  /** Serializable spec: sum these row fields (the grid computes + totals it). */
  sum: string[];
}

export interface Register {
  key: string;
  table: string;
  title: string;
  description: string;
  columns: Column[];
  computed?: ComputedColumn[];
}

export const REGISTERS: Register[] = [
  {
    key: "power",
    table: "power_requirements",
    title: "Power",
    description: "Generators, distro, outlets and site lighting with delivery / collection.",
    columns: [
      { key: "category", label: "Category", type: "text" },
      { key: "item", label: "Item", type: "text" },
      { key: "quantity", label: "Qty", type: "int", align: "right" },
      { key: "location", label: "Location", type: "text" },
      { key: "delivery_date", label: "Delivery", type: "date" },
      { key: "collection_date", label: "Collection", type: "date" },
      { key: "supplier_id", label: "Supplier", type: "supplier" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "structures",
    table: "structures",
    title: "Structures",
    description: "Marquees and structures — sizing, pegging/weighting, docs and engineer sign-off.",
    columns: [
      { key: "name", label: "Name", type: "text" },
      { key: "type", label: "Type", type: "text" },
      { key: "responsible", label: "Resp.", type: "text" },
      { key: "length_m", label: "L (m)", type: "num", align: "right" },
      { key: "width_m", label: "W (m)", type: "num", align: "right" },
      { key: "pegged", label: "Pegged", type: "bool", align: "center" },
      { key: "weighted", label: "Weighted", type: "bool", align: "center" },
      { key: "lighting", label: "Light", type: "bool", align: "center" },
      { key: "walls", label: "Walls", type: "text" },
      { key: "docs_received", label: "Docs", type: "bool", align: "center" },
      { key: "engineer_signoff", label: "Eng. ✓", type: "bool", align: "center" },
      { key: "link", label: "Link", type: "text" },
      { key: "supplier_id", label: "Supplier", type: "supplier" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "fencing",
    table: "fencing_requirements",
    title: "Fencing",
    description: "Fence runs by location with mitigation; total metres computed.",
    columns: [
      { key: "fence_type", label: "Fence type", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "type", label: "Action", type: "text" },
      { key: "length_m", label: "Length (m)", type: "num", align: "right" },
      { key: "mitigation_m", label: "Mitigation (m)", type: "num", align: "right" },
      { key: "supplier_id", label: "Supplier", type: "supplier" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    computed: [{ key: "total_m", label: "Total (m)", sum: ["length_m", "mitigation_m"] }],
  },
  {
    key: "furniture",
    table: "furniture_distribution",
    title: "Furniture",
    description: "Furniture quantities by location and asset type.",
    columns: [
      { key: "location", label: "Location", type: "text" },
      { key: "asset", label: "Asset", type: "text" },
      { key: "quantity", label: "Qty", type: "int", align: "right" },
      { key: "supplier_id", label: "Supplier", type: "supplier" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "transport",
    table: "transport_movements",
    title: "Transport",
    description: "Incoming / outgoing logistics with truck type, doors and gate.",
    columns: [
      { key: "direction", label: "Direction", type: "select", options: ["incoming", "outgoing"] },
      { key: "move_date", label: "Date", type: "date" },
      { key: "move_time", label: "Time", type: "time" },
      { key: "item", label: "Item", type: "text" },
      { key: "from_to", label: "From / To", type: "text" },
      { key: "truck_type", label: "Truck", type: "text" },
      { key: "doors_facing", label: "Doors", type: "text" },
      { key: "gate_entry", label: "Gate", type: "text" },
      { key: "contact_person", label: "Contact", type: "text" },
    ],
  },
  {
    key: "production",
    table: "production_items",
    title: "Production",
    description: "Production activities by date.",
    columns: [
      { key: "item_date", label: "Date", type: "date" },
      { key: "start_time", label: "Start", type: "time" },
      { key: "finish_time", label: "Finish", type: "time" },
      { key: "activity", label: "Activity", type: "text" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "toilets",
    table: "toilet_calculations",
    title: "Toilets",
    description: "General / VIP pan counts; capacity ratio computed (no #DIV/0!).",
    columns: [
      { key: "area", label: "Area", type: "select", options: ["General", "VIP"] },
      { key: "toilet_type", label: "Type", type: "text" },
      { key: "quantity", label: "Qty", type: "int", align: "right" },
      { key: "pans", label: "Pans", type: "int", align: "right" },
      { key: "capacity", label: "Capacity", type: "int", align: "right" },
      { key: "ratio_target", label: "Ratio target", type: "int", align: "right" },
    ],
  },
];

const BY_KEY = new Map(REGISTERS.map((r) => [r.key, r]));
const BY_TABLE = new Map(REGISTERS.map((r) => [r.table, r]));

export function getRegister(key: string): Register | undefined {
  return BY_KEY.get(key);
}
export function getRegisterByTable(table: string): Register | undefined {
  return BY_TABLE.get(table);
}
export function registerFieldType(table: string, field: string): ColType | undefined {
  return BY_TABLE.get(table)?.columns.find((c) => c.key === field)?.type;
}
export const REGISTER_TABLES = new Set(REGISTERS.map((r) => r.table));
