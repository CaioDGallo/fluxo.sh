ALTER TABLE "income" ADD COLUMN "ignored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ignored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "ignored" boolean DEFAULT false NOT NULL;