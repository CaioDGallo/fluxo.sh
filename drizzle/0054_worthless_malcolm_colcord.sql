ALTER TABLE "accounts" ADD COLUMN "institution_logo_url" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "institution_color" text;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "is_pair_candidate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_pair_candidate" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill: Mark existing Pluggy transactions matching transfer patterns as pair candidates
UPDATE transactions
SET is_pair_candidate = true
WHERE external_id IS NOT NULL
  AND external_id LIKE 'pluggy:%'
  AND is_internal_transfer = false
  AND description ~* '(transferencia|transf\y|pix|ted|doc)';--> statement-breakpoint

UPDATE income
SET is_pair_candidate = true
WHERE external_id IS NOT NULL
  AND external_id LIKE 'pluggy:%'
  AND ignored = false
  AND description ~* '(transferencia|transf\y|pix|ted|doc)';