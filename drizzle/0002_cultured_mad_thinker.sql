CREATE TABLE "monthly_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"year_month" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "monthly_budgets_year_month_unique" UNIQUE("year_month")
);
