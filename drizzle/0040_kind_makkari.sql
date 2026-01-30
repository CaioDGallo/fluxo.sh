CREATE TABLE "sent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sent_emails_user_id_email_type_reference_id_unique" UNIQUE("user_id","email_type","reference_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_emails_user_idx ON sent_emails (user_id);
