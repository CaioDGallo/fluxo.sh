/**
 * Check the 3 problematic entries in detail
 */

import { db } from '@/lib/db';
import { entries, transactions, accounts } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

async function check() {
  // Get the 3 entries that are on 2025-12-01 but in wrong fatura
  const problemEntries = await db
    .select({
      entryId: entries.id,
      faturaMonth: entries.faturaMonth,
      purchaseDate: entries.purchaseDate,
      amount: sql<number>`${entries.amount} / 100.0`,
      description: transactions.description,
      externalId: transactions.externalId,
      accountClosingDay: accounts.closingDay,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'credit_card'),
        eq(entries.purchaseDate, '2025-12-01'),
        eq(entries.faturaMonth, '2026-01')
      )
    );

  console.log('Problem Entries (2025-12-01 in wrong fatura):');
  console.table(problemEntries);

  // Also check what other entries exist on 2025-12-01
  const allDec01Entries = await db
    .select({
      entryId: entries.id,
      faturaMonth: entries.faturaMonth,
      purchaseDate: entries.purchaseDate,
      amount: sql<number>`${entries.amount} / 100.0`,
      description: transactions.description,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'credit_card'),
        eq(entries.purchaseDate, '2025-12-01')
      )
    );

  console.log('\nAll entries on 2025-12-01:');
  console.table(allDec01Entries);

  // Check fatura records
  const faturasInfo = await db
    .select({
      yearMonth: sql`year_month`,
      closingDate: sql`closing_date`,
      startDate: sql`start_date`,
      totalAmount: sql<number>`total_amount / 100.0`,
    })
    .from(sql`faturas`)
    .where(sql`year_month IN ('2025-12', '2026-01')`);

  console.log('\nFatura Records:');
  console.table(faturasInfo);
}

check()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
