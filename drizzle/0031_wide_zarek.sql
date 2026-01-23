CREATE TYPE "public"."waitlist_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" "waitlist_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"metadata" text,
	"invite_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_invite_code_invites_code_fk" FOREIGN KEY ("invite_code") REFERENCES "public"."invites"("code") ON DELETE no action ON UPDATE no action;