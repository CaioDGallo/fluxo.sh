-- Add column
ALTER TABLE "users" ADD COLUMN "is_founder" boolean DEFAULT false NOT NULL;

-- Backfill: mark all users who ever had founder subscription
UPDATE "users"
SET "is_founder" = true
WHERE "id" IN (
  SELECT DISTINCT "user_id"
  FROM "billing_subscriptions"
  WHERE "plan_key" = 'founder'
);