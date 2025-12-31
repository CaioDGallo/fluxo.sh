CREATE TABLE "faturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp,
	"paid_from_account_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "faturas_account_id_year_month_unique" UNIQUE("account_id","year_month")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "closing_day" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "payment_due_day" integer;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "fatura_month" text;--> statement-breakpoint
-- Backfill: use dueDate as purchaseDate (best guess for existing data)
UPDATE "entries" SET "purchase_date" = "due_date" WHERE "purchase_date" IS NULL;--> statement-breakpoint
-- Backfill: use YYYY-MM from dueDate as faturaMonth
UPDATE "entries" SET "fatura_month" = to_char("due_date", 'YYYY-MM') WHERE "fatura_month" IS NULL;--> statement-breakpoint
-- Make columns NOT NULL after backfill
ALTER TABLE "entries" ALTER COLUMN "purchase_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "fatura_month" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_paid_from_account_id_accounts_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;