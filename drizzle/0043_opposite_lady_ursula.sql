ALTER TABLE "accounts" ADD COLUMN "external_balance_cents" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "external_balance_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "external_credit_limit_cents" integer;