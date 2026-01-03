-- Drop old unique constraints first
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_category_id_year_month_unique";--> statement-breakpoint
ALTER TABLE "monthly_budgets" DROP CONSTRAINT "monthly_budgets_year_month_unique";--> statement-breakpoint

-- Get the only user from auth.users and backfill all tables
DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- Hardcoded user ID (replace with your actual user ID from auth.users)
  -- To get your user ID: psql <postgres_db_url> -c "SELECT id FROM auth.users;"
  v_user_id := 'f58dd388-190e-4d12-9d8f-126add711507'; -- TODO: Replace with your user ID

  -- Add nullable columns first
  ALTER TABLE "accounts" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "categories" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "budgets" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "monthly_budgets" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "transactions" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "entries" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "faturas" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "income" ADD COLUMN "user_id" TEXT;

  -- Backfill all existing records with the user ID
  UPDATE "accounts" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "categories" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "budgets" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "monthly_budgets" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "transactions" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "entries" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "faturas" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "income" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
END $$;
--> statement-breakpoint

-- Now make the columns NOT NULL
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "faturas" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "income" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Add new unique constraints
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_category_id_year_month_unique" UNIQUE("user_id","category_id","year_month");--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_user_id_year_month_unique" UNIQUE("user_id","year_month");
