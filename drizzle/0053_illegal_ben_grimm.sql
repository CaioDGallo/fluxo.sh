ALTER TABLE "income" ADD COLUMN "beneficiary_name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_business_name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant_cnpj" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "beneficiary_name" text;