CREATE TYPE "public"."bill_occurrence_status" AS ENUM('upcoming', 'pending', 'paid', 'overdue', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "bill_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bill_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"expected_amount" integer,
	"actual_amount" integer,
	"status" "bill_occurrence_status" DEFAULT 'upcoming' NOT NULL,
	"paid_at" timestamp,
	"paid_from_account_id" integer,
	"matched_transaction_id" integer,
	"matched_entry_id" integer,
	"notes" text,
	"acknowledged_at" timestamp,
	"year_month" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bill_occurrences_bill_id_due_date_unique" UNIQUE("bill_id","due_date")
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" integer,
	"expected_amount" integer,
	"is_variable_amount" boolean DEFAULT false NOT NULL,
	"recurrence_type" text DEFAULT 'monthly' NOT NULL,
	"due_day" integer NOT NULL,
	"due_time" text,
	"start_month" text NOT NULL,
	"end_month" text,
	"preferred_account_id" integer,
	"notify_2_days_before" boolean DEFAULT true NOT NULL,
	"notify_1_day_before" boolean DEFAULT true NOT NULL,
	"notify_on_due_day" boolean DEFAULT true NOT NULL,
	"status" "bill_status" DEFAULT 'active' NOT NULL,
	"legacy_bill_reminder_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_paid_from_account_id_accounts_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_occurrences" ADD CONSTRAINT "bill_occurrences_matched_entry_id_entries_id_fk" FOREIGN KEY ("matched_entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_preferred_account_id_accounts_id_fk" FOREIGN KEY ("preferred_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;