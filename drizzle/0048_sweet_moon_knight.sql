ALTER TABLE "faturas" ADD COLUMN "pluggy_bill_id" text;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_account_id_pluggy_bill_id_unique" UNIQUE("account_id","pluggy_bill_id");