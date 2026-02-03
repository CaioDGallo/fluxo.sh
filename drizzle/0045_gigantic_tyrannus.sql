CREATE TABLE "pluggy_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event" text NOT NULL,
	"item_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "pluggy_webhook_events_event_id_unique" UNIQUE("event_id")
);
