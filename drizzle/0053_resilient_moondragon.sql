-- Indexes for faster exports, notifications, and Pluggy sync
CREATE INDEX IF NOT EXISTS "entries_user_account_idx" ON "entries" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_user_fatura_idx" ON "entries" USING btree ("user_id","fatura_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entries_transaction_id_idx" ON "entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_category_idx" ON "transactions" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_user_account_idx" ON "income" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_user_replenish_category_idx" ON "income" USING btree ("user_id","replenish_category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_reminders_status_idx" ON "bill_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_jobs_status_scheduled_idx" ON "notification_jobs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pluggy_items_next_sync_idx" ON "pluggy_items" USING btree ("next_sync_at");--> statement-breakpoint
