CREATE TABLE "management_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"week_date" date,
	"week_label" text,
	"task_no" integer,
	"task" text,
	"hours" numeric(6, 2),
	"completed" boolean DEFAULT false NOT NULL,
	"role" text,
	"rate_cents" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "management_event_idx" ON "management_tasks" USING btree ("event_id");