/**
 * Advancer — database schema (Milestone 1 spine).
 *
 * Drizzle is the source of truth for tables. `npm run db:generate` emits SQL
 * under ./drizzle which is applied to Supabase via the MCP apply_migration
 * tool. RLS policies, cross-module FKs and seed data are layered on top as
 * additive SQL (see drizzle/9999_rls_and_seed.sql).
 *
 * Conventions:
 *  - All ids are uuid (gen_random_uuid()).
 *  - Money is stored as integer cents. GST = Australian 10%, computed in code.
 *  - Times are typed `time`; dates are typed `date`. No spreadsheet strings.
 *  - user_id / created_by columns reference auth.users — the FK is added in
 *    the additive SQL migration to avoid drizzle touching the auth schema.
 *  - Every mutable table carries created_at / updated_at / deleted_at (soft delete).
 */
import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  time,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ enums */

export const orgRole = pgEnum("org_role", [
  "owner",
  "admin",
  "event_manager",
  "operations_manager",
  "accounts",
  "site_manager",
  "viewer",
]);

export const eventStatus = pgEnum("event_status", [
  "planning",
  "active",
  "delivered",
  "archived",
]);

export const scheduleType = pgEnum("schedule_type", [
  "ON_SITE",
  "INSTALL",
  "COLLECTION",
  "DELIVERY",
  "SHOW_TIME",
  "BUMP_OUT",
  "DROP_OFF",
  "PICK_UP",
  "SECURITY",
]);

export const progressStatus = pgEnum("progress_status", [
  "not_started",
  "in_progress",
  "blocked",
  "done",
]);

export const rfqStatus = pgEnum("rfq_status", [
  "not_sent",
  "sent",
  "responded",
  "declined",
]);

export const bookingStatus = pgEnum("booking_status", [
  "not_booked",
  "tentative",
  "booked",
  "cancelled",
]);

export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "partial",
  "paid",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const priority = pgEnum("priority", ["low", "normal", "high", "critical"]);

export const importStatus = pgEnum("import_status", [
  "uploaded",
  "parsed",
  "previewed",
  "committed",
  "failed",
]);

/* --------------------------------------------------------- common columns */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/* -------------------------------------------------------- tenancy / identity */

export const organisations = pgTable("organisations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});

// Mirror of auth.users (1:1). id == auth.users.id (FK added in additive SQL).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  fullName: text("full_name"),
  avatarPath: text("avatar_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Admin-issued email invites; accept_pending_invites() grants membership on
 *  the invitee's first authenticated request. */
export const orgInvites = pgTable(
  "org_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRole("role").notNull().default("viewer"),
    invitedBy: uuid("invited_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("org_invites_org_idx").on(t.orgId)],
);

export const organisationMembers = pgTable(
  "organisation_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // -> auth.users.id (FK in additive SQL)
    role: orgRole("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("organisation_members_org_user_uq").on(t.orgId, t.userId)],
);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  ...timestamps,
});

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  notes: text("notes"),
  ...timestamps,
});

/* ----------------------------------------------------------------- event core */

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: eventStatus("status").notNull().default("planning"),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
    timezone: text("timezone").notNull().default("Australia/Perth"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // Editable phase ranges → drive schedule regeneration + crew day headings.
    bumpInStart: date("bump_in_start"),
    bumpInEnd: date("bump_in_end"),
    eventStart: date("event_start"),
    eventEnd: date("event_end"),
    bumpOutStart: date("bump_out_start"),
    bumpOutEnd: date("bump_out_end"),
    imagePath: text("image_path"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [index("events_org_idx").on(t.orgId)],
);

export const eventContacts = pgTable("event_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  position: text("position"),
  name: text("name"),
  company: text("company"),
  mobile: text("mobile"),
  email: text("email"),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventBillingProfiles = pgTable("event_billing_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  approver: text("approver"),
  responsible: text("responsible"),
  billingEntity: text("billing_entity"),
  abn: text("abn"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventSiteMaps = pgTable("event_site_maps", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  version: text("version"),
  label: text("label"),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Tokenised read-only portal links (client/venue or supplier). Reads go
 *  through the SECURITY DEFINER `portal_payload(token)` RPC, so this table's
 *  RLS only has to cover in-app management. */
export const eventShareLinks = pgTable(
  "event_share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'client' | 'supplier'
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    label: text("label"),
    createdBy: uuid("created_by"),
    // M20: defaults to now() + 90 days (0015) — no unbounded portal tokens.
    expiresAt: timestamp("expires_at", { withTimezone: true }).default(
      sql`now() + interval '90 days'`,
    ),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("event_share_links_event_idx").on(t.eventId)],
);

/* ------------------------------------------------------------ suppliers (thin) */

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  abn: text("abn"),
  insurance: boolean("insurance").notNull().default(false),
  serviceCategories: text("service_categories").array(),
  preferred: boolean("preferred").notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

/** People at a supplier (the thin `suppliers.contact_*` columns hold the primary; this
 *  table carries the full list). */
export const supplierContacts = pgTable(
  "supplier_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("supplier_contacts_supplier_idx").on(t.supplierId)],
);

/** Supplier documents (insurance certs, ABN/capability docs) in the supplier-docs bucket. */
export const supplierDocuments = pgTable(
  "supplier_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    label: text("label"),
    docType: text("doc_type"),
    filePath: text("file_path").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("supplier_documents_supplier_idx").on(t.supplierId)],
);

/* ------------------------------------------------------------------- checklist */

export const checklistSections = pgTable("checklist_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => checklistSections.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    item: text("item").notNull(),
    details: text("details"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    responsible: text("responsible"),
    rfqStatus: rfqStatus("rfq_status").notNull().default("not_sent"),
    bookingStatus: bookingStatus("booking_status").notNull().default("not_booked"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    status: progressStatus("status").notNull().default("not_started"),
    priority: priority("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    // cross-module links (FKs added in additive SQL, nullable, ON DELETE SET NULL)
    budgetItemId: uuid("budget_item_id"),
    managementTaskId: uuid("management_task_id"),
    scheduleEntryId: uuid("schedule_entry_id"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("checklist_items_event_idx").on(t.eventId)],
);

export const checklistItemStatusHistory = pgTable("checklist_item_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => checklistItems.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: uuid("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------------------------------------------------------------------- budget */

export const budgetVersions = pgTable("budget_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const budgetCategories = pgTable("budget_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id")
    .notNull()
    .references(() => budgetVersions.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const budgetItems = pgTable(
  "budget_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => budgetCategories.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    item: text("item").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    insurance: text("insurance"),
    quotedExGstCents: integer("quoted_ex_gst_cents").notNull().default(0),
    actualIncGstCents: integer("actual_inc_gst_cents").notNull().default(0),
    quoteLink: text("quote_link"),
    approvalStatus: approvalStatus("approval_status").notNull().default("pending"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    rfqNo: text("rfq_no"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("budget_items_event_idx").on(t.eventId)],
);

/** High-level estimate lines (the workbook ESTIMATE sheet) — coarser than the
 *  detailed budget; compared against budget quoted/actual totals on the
 *  Estimate page. Amounts are ex-GST integer cents. */
export const estimateItems = pgTable(
  "estimate_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    description: text("description").notNull(),
    estimateExGstCents: integer("estimate_ex_gst_cents").notNull().default(0),
    quoteExGstCents: integer("quote_ex_gst_cents"),
    possibleReductionCents: integer("possible_reduction_cents"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("estimate_items_event_idx").on(t.eventId)],
);

/* -------------------------------------------------------------------- schedule */

export const scheduleEntries = pgTable(
  "schedule_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    eventDate: date("event_date"),
    startTime: time("start_time"),
    finishTime: time("finish_time"),
    type: scheduleType("type"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    supplierText: text("supplier_text"),
    action: text("action"),
    location: text("location"),
    sitePoc: text("site_poc"),
    notes: text("notes"),
    completed: boolean("completed").notNull().default(false),
    criticalPath: boolean("critical_path").notNull().default(false),
    // Phase-day skeleton rows (Bump-in/Event/Bump-out) generated from the event's
    // editable date ranges — regeneration only ever touches these, never manual rows.
    autoGenerated: boolean("auto_generated").notNull().default(false),
    // cross-module links (FKs added in additive SQL)
    checklistItemId: uuid("checklist_item_id"),
    budgetItemId: uuid("budget_item_id"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("schedule_entries_event_idx").on(t.eventId),
    index("schedule_entries_date_idx").on(t.eventId, t.eventDate),
  ],
);

/* ------------------------------------------------------------------- reference */

export const referenceValues = pgTable("reference_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // 'person' | 'schedule_type' | 'zone' | 'truck_type'
  value: text("value").notNull(),
  label: text("label"),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------------ rfqs */

export const rfqWorkflowStatus = pgEnum("rfq_workflow_status", [
  "draft",
  "sent",
  "responded",
  "awarded",
  "declined",
  "cancelled",
]);

export const rfqRecipientStatus = pgEnum("rfq_recipient_status", [
  "pending",
  "sent",
  "responded",
  "declined",
]);

export const rfqs = pgTable(
  "rfqs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    rfqNo: text("rfq_no"),
    title: text("title").notNull(),
    status: rfqWorkflowStatus("status").notNull().default("draft"),
    deliveryDate: date("delivery_date"),
    collectionDate: date("collection_date"),
    responseDueDate: date("response_due_date"),
    location: text("location"),
    notes: text("notes"),
    // FK to rfq_recipients added in additive SQL (circular ref), ON DELETE SET NULL
    awardedRecipientId: uuid("awarded_recipient_id"),
    budgetCategoryId: uuid("budget_category_id").references(() => budgetCategories.id, {
      onDelete: "set null",
    }),
    budgetItemId: uuid("budget_item_id"),
    checklistItemId: uuid("checklist_item_id"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [index("rfqs_event_idx").on(t.eventId)],
);

export const rfqItems = pgTable(
  "rfq_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: text("quantity"),
    unit: text("unit"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("rfq_items_rfq_idx").on(t.rfqId)],
);

export const rfqRecipients = pgTable(
  "rfq_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    status: rfqRecipientStatus("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    quotedExGstCents: integer("quoted_ex_gst_cents"),
    quoteLink: text("quote_link"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("rfq_recipients_rfq_idx").on(t.rfqId)],
);

/** Per-line price a recipient quoted for an rfq_item — the itemised breakdown
 *  behind the recipient's lump `quoted_ex_gst_cents` total. */
export const rfqQuotes = pgTable(
  "rfq_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqRecipientId: uuid("rfq_recipient_id")
      .notNull()
      .references(() => rfqRecipients.id, { onDelete: "cascade" }),
    rfqItemId: uuid("rfq_item_id")
      .notNull()
      .references(() => rfqItems.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    unitPriceCents: integer("unit_price_cents"),
    lineTotalCents: integer("line_total_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("rfq_quotes_recipient_idx").on(t.rfqRecipientId),
    uniqueIndex("rfq_quotes_recipient_item_uq").on(t.rfqRecipientId, t.rfqItemId),
  ],
);

/** A file a supplier returned with their quote (uploaded to the rfq-attachments bucket). */
export const rfqAttachments = pgTable(
  "rfq_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rfqRecipientId: uuid("rfq_recipient_id")
      .notNull()
      .references(() => rfqRecipients.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    label: text("label"),
    filePath: text("file_path").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("rfq_attachments_recipient_idx").on(t.rfqRecipientId)],
);

/* --------------------------------------------------------------- event documents */

/** Per-event document register: an uploaded file (file_path, event-docs bucket) OR an
 *  external link (external_url), optionally tied to a supplier / RFQ / budget line /
 *  schedule entry. Either file_path or external_url is set (enforced in the action). */
export const eventDocuments = pgTable(
  "event_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category"),
    filePath: text("file_path"),
    externalUrl: text("external_url"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    rfqId: uuid("rfq_id").references(() => rfqs.id, { onDelete: "set null" }),
    budgetItemId: uuid("budget_item_id").references(() => budgetItems.id, { onDelete: "set null" }),
    scheduleEntryId: uuid("schedule_entry_id").references(() => scheduleEntries.id, { onDelete: "set null" }),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [index("event_documents_event_idx").on(t.eventId)],
);

/* ----------------------------------------------------------- crew + labour cost */

export const crewRoles = pgTable("crew_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  defaultRateCents: integer("default_rate_cents"),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crewShifts = pgTable(
  "crew_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    shiftDate: date("shift_date"),
    dayLabel: text("day_label"),
    roleId: uuid("role_id").references(() => crewRoles.id, { onDelete: "set null" }),
    roleName: text("role_name"),
    person: text("person"),
    quantity: integer("quantity").notNull().default(1),
    startTime: time("start_time"),
    finishTime: time("finish_time"),
    scheduledHours: numeric("scheduled_hours", { precision: 6, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
    rateCents: integer("rate_cents"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("crew_shifts_event_idx").on(t.eventId),
    index("crew_shifts_date_idx").on(t.eventId, t.shiftDate),
  ],
);

/* -------------------------------------------------------------- infrastructure */

export const powerRequirements = pgTable(
  "power_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    category: text("category"),
    item: text("item"),
    quantity: integer("quantity"),
    location: text("location"),
    deliveryDate: date("delivery_date"),
    collectionDate: date("collection_date"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("power_event_idx").on(t.eventId)],
);

export const structures = pgTable(
  "structures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name"),
    type: text("type"),
    responsible: text("responsible"),
    lengthM: numeric("length_m", { precision: 8, scale: 2 }),
    widthM: numeric("width_m", { precision: 8, scale: 2 }),
    pegged: boolean("pegged").notNull().default(false),
    weighted: boolean("weighted").notNull().default(false),
    lighting: boolean("lighting").notNull().default(false),
    walls: text("walls"),
    docsReceived: boolean("docs_received").notNull().default(false),
    engineerSignoff: boolean("engineer_signoff").notNull().default(false),
    link: text("link"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("structures_event_idx").on(t.eventId)],
);

export const fencingRequirements = pgTable(
  "fencing_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fenceType: text("fence_type"),
    location: text("location"),
    type: text("type"),
    lengthM: numeric("length_m", { precision: 8, scale: 2 }),
    mitigationM: numeric("mitigation_m", { precision: 8, scale: 2 }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("fencing_event_idx").on(t.eventId)],
);

export const furnitureDistribution = pgTable(
  "furniture_distribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    location: text("location"),
    asset: text("asset"),
    quantity: integer("quantity"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("furniture_event_idx").on(t.eventId)],
);

export const transportMovements = pgTable(
  "transport_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    direction: text("direction"),
    moveDate: date("move_date"),
    moveTime: time("move_time"),
    item: text("item"),
    fromTo: text("from_to"),
    truckType: text("truck_type"),
    doorsFacing: text("doors_facing"),
    gateEntry: text("gate_entry"),
    contactPerson: text("contact_person"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("transport_event_idx").on(t.eventId)],
);

export const productionItems = pgTable(
  "production_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    itemDate: date("item_date"),
    startTime: time("start_time"),
    finishTime: time("finish_time"),
    activity: text("activity"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("production_event_idx").on(t.eventId)],
);

export const toiletCalculations = pgTable(
  "toilet_calculations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    area: text("area"),
    toiletType: text("toilet_type"),
    quantity: integer("quantity"),
    pans: integer("pans"),
    capacity: integer("capacity"),
    ratioTarget: integer("ratio_target"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("toilet_event_idx").on(t.eventId)],
);

/* ---------------------------------------------------------- management schedule */

export const managementTasks = pgTable(
  "management_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    weekDate: date("week_date"),
    weekLabel: text("week_label"),
    taskNo: integer("task_no"),
    task: text("task"),
    hours: numeric("hours", { precision: 6, scale: 2 }),
    completed: boolean("completed").notNull().default(false),
    role: text("role"),
    rateCents: integer("rate_cents"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("management_event_idx").on(t.eventId)],
);

/* ------------------------------------------------------------------- site notes */

export const siteNoteSeverity = pgEnum("site_note_severity", ["info", "issue", "urgent"]);

export const siteNotes = pgTable(
  "site_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    severity: siteNoteSeverity("severity").notNull().default("info"),
    scheduleEntryId: uuid("schedule_entry_id").references(() => scheduleEntries.id, {
      onDelete: "set null",
    }),
    photoPath: text("photo_path"),
    resolved: boolean("resolved").notNull().default(false),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("site_notes_event_idx").on(t.eventId)],
);

/* ---------------------------------------------------------------- food & beverage */

// Vendor line-up + site needs + compliance + commercials (income tracked here,
// not in the cost-only budget). Vendors link to the org-wide suppliers list; the
// trading name is kept separately as the stall name often differs.
export const fnbVendors = pgTable(
  "fnb_vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    tradingName: text("trading_name"),
    vendorType: text("vendor_type"),
    location: text("location"),
    frontageM: numeric("frontage_m", { precision: 8, scale: 2 }),
    powerReq: text("power_req"),
    water: boolean("water").notNull().default(false),
    waste: boolean("waste").notNull().default(false),
    arrivalDate: date("arrival_date"),
    arrivalTime: time("arrival_time"),
    licenceStatus: text("licence_status").notNull().default("missing"),
    coiStatus: text("coi_status").notNull().default("missing"),
    permitStatus: text("permit_status").notNull().default("missing"),
    siteFeeCents: integer("site_fee_cents"),
    commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }),
    bondCents: integer("bond_cents"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("fnb_vendors_event_idx").on(t.eventId)],
);

// Crew catering — per-day meal orders for staff.
export const fnbCateringOrders = pgTable(
  "fnb_catering_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orderDate: date("order_date"),
    meal: text("meal"),
    headcount: integer("headcount"),
    dietary: text("dietary"),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    costCents: integer("cost_cents"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("fnb_catering_event_idx").on(t.eventId)],
);

/* ---------------------------------------------------------------- quotes & invoices */

// Supplier quote/invoice records against a budget line. Holds both kinds
// (kind = 'quote' | 'invoice'); invoices feed the line's actual_inc_gst_cents +
// payment_status via lib/invoices/sync.ts. Files live in the event-docs bucket.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    budgetItemId: uuid("budget_item_id").references(() => budgetItems.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("invoice"),
    reference: text("reference"),
    issuedDate: date("issued_date"),
    dueDate: date("due_date"),
    amountIncGstCents: integer("amount_inc_gst_cents"),
    status: text("status").notNull().default("received"),
    filePath: text("file_path"),
    externalUrl: text("external_url"),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("invoices_event_idx").on(t.eventId),
    index("invoices_budget_item_idx").on(t.budgetItemId),
  ],
);

/* ---------------------------------------------------------------- import + audit */

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storagePath: text("storage_path"),
  status: importStatus("status").notNull().default("uploaded"),
  report: jsonb("report"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const importJobRows = pgTable("import_job_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => importJobs.id, { onDelete: "cascade" }),
  sheet: text("sheet").notNull(),
  rowRef: text("row_ref"),
  mappedTable: text("mapped_table"),
  raw: jsonb("raw"),
  warnings: jsonb("warnings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id"),
    actor: uuid("actor"),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_log_event_idx").on(t.eventId)],
);
