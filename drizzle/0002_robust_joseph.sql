CREATE TABLE "crew_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_rate_cents" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"shift_date" date,
	"day_label" text,
	"role_id" uuid,
	"role_name" text,
	"person" text,
	"start_time" time,
	"finish_time" time,
	"scheduled_hours" numeric(6, 2),
	"actual_hours" numeric(6, 2),
	"rate_cents" integer,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "crew_roles" ADD CONSTRAINT "crew_roles_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_shifts" ADD CONSTRAINT "crew_shifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_shifts" ADD CONSTRAINT "crew_shifts_role_id_crew_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."crew_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crew_shifts_event_idx" ON "crew_shifts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "crew_shifts_date_idx" ON "crew_shifts" USING btree ("event_id","shift_date");