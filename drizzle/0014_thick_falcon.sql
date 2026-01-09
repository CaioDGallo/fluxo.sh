CREATE TYPE "public"."calendar_source_status" AS ENUM('active', 'error', 'disabled');--> statement-breakpoint
CREATE TABLE "calendar_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" "calendar_source_status" DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#3b82f6',
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"sync_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "calendar_sources_user_id_url_unique" UNIQUE("user_id","url")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "calendar_source_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "external_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE cascade ON UPDATE no action;