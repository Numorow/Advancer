CREATE TABLE "fencing_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"fence_type" text,
	"location" text,
	"type" text,
	"length_m" numeric(8, 2),
	"mitigation_m" numeric(8, 2),
	"supplier_id" uuid,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "furniture_distribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"location" text,
	"asset" text,
	"quantity" integer,
	"supplier_id" uuid,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "power_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"category" text,
	"item" text,
	"quantity" integer,
	"location" text,
	"delivery_date" date,
	"collection_date" date,
	"supplier_id" uuid,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "production_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"item_date" date,
	"start_time" time,
	"finish_time" time,
	"activity" text,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text,
	"type" text,
	"responsible" text,
	"length_m" numeric(8, 2),
	"width_m" numeric(8, 2),
	"pegged" boolean DEFAULT false NOT NULL,
	"weighted" boolean DEFAULT false NOT NULL,
	"lighting" boolean DEFAULT false NOT NULL,
	"walls" text,
	"docs_received" boolean DEFAULT false NOT NULL,
	"engineer_signoff" boolean DEFAULT false NOT NULL,
	"link" text,
	"supplier_id" uuid,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "toilet_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"area" text,
	"toilet_type" text,
	"quantity" integer,
	"pans" integer,
	"capacity" integer,
	"ratio_target" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transport_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"direction" text,
	"move_date" date,
	"move_time" time,
	"item" text,
	"from_to" text,
	"truck_type" text,
	"doors_facing" text,
	"gate_entry" text,
	"contact_person" text,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fencing_requirements" ADD CONSTRAINT "fencing_requirements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fencing_requirements" ADD CONSTRAINT "fencing_requirements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "furniture_distribution" ADD CONSTRAINT "furniture_distribution_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "furniture_distribution" ADD CONSTRAINT "furniture_distribution_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_requirements" ADD CONSTRAINT "power_requirements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_requirements" ADD CONSTRAINT "power_requirements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_items" ADD CONSTRAINT "production_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structures" ADD CONSTRAINT "structures_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toilet_calculations" ADD CONSTRAINT "toilet_calculations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_movements" ADD CONSTRAINT "transport_movements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fencing_event_idx" ON "fencing_requirements" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "furniture_event_idx" ON "furniture_distribution" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "power_event_idx" ON "power_requirements" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "production_event_idx" ON "production_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "structures_event_idx" ON "structures" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "toilet_event_idx" ON "toilet_calculations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "transport_event_idx" ON "transport_movements" USING btree ("event_id");