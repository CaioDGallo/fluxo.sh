DROP TABLE "transfers" CASCADE;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_internal_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_fatura_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP TYPE "public"."transfer_type";