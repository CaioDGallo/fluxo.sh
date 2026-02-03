CREATE TYPE "public"."account_source" AS ENUM('manual', 'pluggy');--> statement-breakpoint
CREATE TABLE "pluggy_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"pluggy_account_id" text NOT NULL,
	"account_id" integer,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"subtype" text,
	"currency" text DEFAULT 'BRL',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pluggy_accounts_user_id_pluggy_account_id_unique" UNIQUE("user_id","pluggy_account_id"),
	CONSTRAINT "pluggy_accounts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "pluggy_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pluggy_item_id" text NOT NULL,
	"connector_id" text,
	"status" text,
	"status_detail" text,
	"last_updated_at" timestamp,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pluggy_items_user_id_pluggy_item_id_unique" UNIQUE("user_id","pluggy_item_id")
);
--> statement-breakpoint
CREATE TABLE "pluggy_sync_cursors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"scope" text NOT NULL,
	"cursor" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pluggy_sync_cursors_item_id_scope_unique" UNIQUE("item_id","scope")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "source" "account_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD CONSTRAINT "pluggy_accounts_item_id_pluggy_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."pluggy_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pluggy_accounts" ADD CONSTRAINT "pluggy_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pluggy_sync_cursors" ADD CONSTRAINT "pluggy_sync_cursors_item_id_pluggy_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."pluggy_items"("id") ON DELETE cascade ON UPDATE no action;