CREATE TYPE "public"."site_note_severity" AS ENUM('info', 'issue', 'urgent');--> statement-breakpoint
CREATE TABLE "site_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"body" text NOT NULL,
	"severity" "site_note_severity" DEFAULT 'info' NOT NULL,
	"schedule_entry_id" uuid,
	"photo_path" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_notes" ADD CONSTRAINT "site_notes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_notes" ADD CONSTRAINT "site_notes_schedule_entry_id_schedule_entries_id_fk" FOREIGN KEY ("schedule_entry_id") REFERENCES "public"."schedule_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_notes_event_idx" ON "site_notes" USING btree ("event_id");