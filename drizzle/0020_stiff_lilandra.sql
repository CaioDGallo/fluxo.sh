CREATE TABLE "category_frequency" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description_normalized" text NOT NULL,
	"category_id" integer NOT NULL,
	"type" "category_type" NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"last_used_at" timestamp DEFAULT now(),
	CONSTRAINT "category_frequency_user_id_description_normalized_category_id_type_unique" UNIQUE("user_id","description_normalized","category_id","type")
);
--> statement-breakpoint
ALTER TABLE "category_frequency" ADD CONSTRAINT "category_frequency_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;