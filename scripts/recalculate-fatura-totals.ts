/**
 * Recalculate all fatura totals based on current entries and refunds
 */

import { db } from '@/lib/db';
import { accounts, faturas, entries, income } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

async function recalculate() {
  console.log('═══════════════════════════════════════════════════');
  console.log('RECALCULATING FATURA TOTALS');
  console.log('═══════════════════════════════════════════════════\n');

  // Get all credit card accounts with userId
  const cards = await db
    .select({ id: accounts.id, name: accounts.name, userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'));

  if (cards.length === 0) {
    console.log('No credit card accounts found');
    return;
  }

  console.log(`Found ${cards.length} credit card account(s)\n`);

  for (const card of cards) {
    console.log(`Processing: ${card.name} (ID: ${card.id})`);

    // Get all faturas for this account
    const fats = await db
      .select({ yearMonth: faturas.yearMonth, totalAmount: faturas.totalAmount })
      .from(faturas)
      .where(eq(faturas.accountId, card.id))
      .orderBy(faturas.yearMonth);

    if (fats.length === 0) {
      console.log('  No faturas found\n');
      continue;
    }

    console.log(`  Found ${fats.length} faturas`);

    // Recalculate each fatura individually
    for (const fat of fats) {
      // Sum entries
      const entriesResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${entries.amount}), 0)` })
        .from(entries)
        .where(
          sql`${entries.userId} = ${card.userId}
              AND ${entries.accountId} = ${card.id}
              AND ${entries.faturaMonth} = ${fat.yearMonth}`
        );

      // Sum refunds
      const refundsResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${income.amount}), 0)` })
        .from(income)
        .where(
          sql`${income.userId} = ${card.userId}
              AND ${income.accountId} = ${card.id}
              AND ${income.faturaMonth} = ${fat.yearMonth}`
        );

      const entriesTotal = entriesResult[0]?.total || 0;
      const refundsTotal = refundsResult[0]?.total || 0;
      const newTotal = entriesTotal - refundsTotal;

      // Update fatura
      await db
        .update(faturas)
        .set({ totalAmount: newTotal })
        .where(
          sql`${faturas.userId} = ${card.userId}
              AND ${faturas.accountId} = ${card.id}
              AND ${faturas.yearMonth} = ${fat.yearMonth}`
        );
    }

    // Show results
    const updated = await db
      .select({ yearMonth: faturas.yearMonth, totalAmount: faturas.totalAmount })
      .from(faturas)
      .where(eq(faturas.accountId, card.id))
      .orderBy(faturas.yearMonth);

    console.log('  Updated totals:');
    for (const f of updated) {
      const oldTotal = fats.find(old => old.yearMonth === f.yearMonth)?.totalAmount || 0;
      const changed = oldTotal !== f.totalAmount ? '(changed)' : '';
      console.log(`    ${f.yearMonth}: R$ ${(f.totalAmount / 100).toFixed(2)} ${changed}`);
    }

    console.log(`✓ Done with ${card.name}\n`);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('RECALCULATION COMPLETE');
  console.log('═══════════════════════════════════════════════════');
}

recalculate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
