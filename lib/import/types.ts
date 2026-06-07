import type { Enums } from "@/lib/db/database.types";

export type ScheduleTypeEnum = Enums<"schedule_type">;

export const SCHEDULE_TYPES: ScheduleTypeEnum[] = [
  "ON_SITE",
  "INSTALL",
  "COLLECTION",
  "DELIVERY",
  "SHOW_TIME",
  "BUMP_OUT",
  "DROP_OFF",
  "PICK_UP",
  "SECURITY",
];

export interface ParseWarning {
  sheet: string;
  cell: string;
  kind: "formula_error" | "unmapped_type" | "unparsed";
  message: string;
}

export interface ParsedChecklistItem {
  section: string;
  item: string;
  details?: string;
  supplier?: string;
  responsible?: string;
  rfqSent: boolean;
  booked: boolean;
  paid: boolean;
  rowRef: string;
}

export interface ParsedBudgetItem {
  category: string;
  item: string;
  supplier?: string;
  insurance?: string;
  quotedExGstCents: number | null;
  actualIncGstCents: number | null;
  quoteLink?: string;
  approved: boolean;
  paid: boolean;
  rfqNo?: string;
  notes?: string;
  rowRef: string;
}

export interface ParsedScheduleEntry {
  eventDate: string | null;
  startTime: string | null;
  finishTime: string | null;
  type: ScheduleTypeEnum | null;
  typeRaw?: string;
  supplier?: string;
  action?: string;
  location?: string;
  sitePoc?: string;
  notes?: string;
  completed: boolean;
  rowRef: string;
}

export interface ParsedContact {
  position?: string;
  name?: string;
  company?: string;
  mobile?: string;
  email?: string;
  rowRef: string;
}

export interface ParsedSiteMap {
  label?: string;
  url?: string;
  rowRef: string;
}

export interface ParsedCrewShift {
  shiftDate: string | null;
  dayLabel?: string;
  role?: string;
  startTime: string | null;
  finishTime: string | null;
  scheduledHours: number | null;
  actualHours: number | null;
  rateCents: number | null;
  rowRef: string;
}

export interface ParsedPower {
  category?: string;
  item?: string;
  quantity: number | null;
  location?: string;
  deliveryDate: string | null;
  collectionDate: string | null;
  notes?: string;
  rowRef: string;
}

export interface ParsedStructure {
  name?: string;
  type?: string;
  responsible?: string;
  lengthM: number | null;
  widthM: number | null;
  pegged: boolean;
  weighted: boolean;
  lighting: boolean;
  walls?: string;
  docsReceived: boolean;
  engineerSignoff: boolean;
  link?: string;
  notes?: string;
  rowRef: string;
}

export interface ParsedFencing {
  fenceType?: string;
  location?: string;
  type?: string;
  lengthM: number | null;
  mitigationM: number | null;
  notes?: string;
  rowRef: string;
}

export interface ParsedFurniture {
  location?: string;
  asset?: string;
  quantity: number | null;
  rowRef: string;
}

export interface ParsedToilet {
  area: string;
  toiletType?: string;
  quantity: number | null;
  pans: number | null;
  capacity: number | null;
  ratioTarget: number | null;
  rowRef: string;
}

export interface ParsedTransport {
  direction?: string;
  moveDate: string | null;
  moveTime: string | null;
  item?: string;
  fromTo?: string;
  truckType?: string;
  doorsFacing?: string;
  gateEntry?: string;
  contactPerson?: string;
  rowRef: string;
}

export interface ParsedProduction {
  itemDate: string | null;
  startTime: string | null;
  finishTime: string | null;
  activity?: string;
  notes?: string;
  rowRef: string;
}

export interface ParsedManagementTask {
  weekDate: string | null;
  weekLabel?: string;
  taskNo: number | null;
  task?: string;
  hours: number | null;
  completed: boolean;
  role?: string;
  rateCents: number | null;
  rowRef: string;
}

export interface ParsedInfrastructure {
  power: ParsedPower[];
  structures: ParsedStructure[];
  fencing: ParsedFencing[];
  furniture: ParsedFurniture[];
  toilets: ParsedToilet[];
  transport: ParsedTransport[];
  production: ParsedProduction[];
}

export interface ParsedWorkbook {
  eventName: string;
  checklist: ParsedChecklistItem[];
  budget: ParsedBudgetItem[];
  schedule: ParsedScheduleEntry[];
  contacts: ParsedContact[];
  siteMaps: ParsedSiteMap[];
  crew: ParsedCrewShift[];
  infrastructure: ParsedInfrastructure;
  management: ParsedManagementTask[];
  warnings: ParseWarning[];
  counts: Record<string, number>;
}
