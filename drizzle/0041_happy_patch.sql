CREATE TYPE "public"."budget_bucket" AS ENUM('necessities', 'wants', 'savings');--> statement-breakpoint
CREATE TYPE "public"."budget_preset" AS ENUM('na_risca', 'entrando_na_linha', 'custom');--> statement-breakpoint
CREATE TABLE "budget_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"preset" "budget_preset" DEFAULT 'na_risca' NOT NULL,
	"custom_necessities" integer,
	"custom_wants" integer,
	"custom_savings" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "budget_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "bucket" "budget_bucket";--> statement-breakpoint
-- Set default bucket assignments for existing categories
UPDATE "categories" SET "bucket" = 'necessities' WHERE LOWER("name") IN ('alimentacao', 'alimentação', 'transporte', 'moradia', 'contas', 'saude', 'saúde', 'educacao', 'educação');--> statement-breakpoint
UPDATE "categories" SET "bucket" = 'wants' WHERE LOWER("name") IN ('entretenimento', 'compras', 'lazer', 'assinaturas');