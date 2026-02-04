-- Step 1: Add fatura_id column (nullable)
ALTER TABLE "entries" ADD COLUMN "fatura_id" integer;--> statement-breakpoint

-- Step 2: Backfill fatura_id by matching entries to faturas via (user_id, account_id, fatura_month)
UPDATE entries
SET fatura_id = faturas.id
FROM faturas
WHERE entries.user_id = faturas.user_id
  AND entries.account_id = faturas.account_id
  AND entries.fatura_month = faturas.year_month;--> statement-breakpoint

-- Step 3: Add foreign key constraint
ALTER TABLE "entries" ADD CONSTRAINT "entries_fatura_id_faturas_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Step 4: Add index for performance on fatura_id lookups
CREATE INDEX IF NOT EXISTS "entries_fatura_id_idx" ON "entries" ("fatura_id");