CREATE TABLE "budget_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"threshold" integer NOT NULL,
	"last_sent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "budget_alerts_user_id_category_id_year_month_threshold_unique" UNIQUE("user_id","category_id","year_month","threshold")
);
--> statement-breakpoint
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;