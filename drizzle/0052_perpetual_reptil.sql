-- Add composite indexes for expenses/income query optimization
CREATE INDEX IF NOT EXISTS "entries_user_purchase_date_idx" ON "entries" USING btree ("user_id","purchase_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_user_received_date_idx" ON "income" USING btree ("user_id","received_date");