ALTER TABLE "pluggy_accounts" ADD COLUMN "mask" text;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD COLUMN "institution_name" text;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "pluggy_items" ADD COLUMN "next_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "pluggy_items" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "pluggy_items" ADD COLUMN "consent_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "pluggy_items" ADD COLUMN "client_user_id" text;