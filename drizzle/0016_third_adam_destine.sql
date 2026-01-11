ALTER TABLE "user_settings" ADD COLUMN "daily_digest_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "daily_digest_time" text DEFAULT '08:00';