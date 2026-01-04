/**
 * One-time script to backfill fatura records for existing credit card entries.
 *
 * Run with: npx tsx drizzle/backfill-faturas.ts
 */

import { backfillFaturas } from '@/lib/actions/faturas';

async function main() {
  console.log('Starting fatura backfill...');

  const result = await backfillFaturas();

  if ('error' in result) {
    console.error('✗ Backfill failed:', result.error);
    process.exit(1);
  }

  console.log(`✓ Successfully created ${result.created} fatura records`);
}

main();
