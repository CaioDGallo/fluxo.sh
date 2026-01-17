-- Add column as nullable first
ALTER TABLE "faturas" ADD COLUMN "closing_date" date;

-- Backfill from account defaults: compute closing date based on yearMonth and account's closingDay
UPDATE faturas f
SET closing_date = (
  SELECT make_date(
    EXTRACT(YEAR FROM (f.year_month || '-01')::date)::int,
    EXTRACT(MONTH FROM (f.year_month || '-01')::date)::int,
    LEAST(
      COALESCE(a.closing_day, 1),
      EXTRACT(DAY FROM (
        (f.year_month || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day'
      ))::int
    )
  )
  FROM accounts a
  WHERE a.id = f.account_id
);

-- Make NOT NULL after backfill
ALTER TABLE "faturas" ALTER COLUMN "closing_date" SET NOT NULL;
