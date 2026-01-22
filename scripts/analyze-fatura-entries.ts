/**
 * Analyze what entries are in each fatura month
 */

import { db } from '@/lib/db';
import { entries, transactions, accounts } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

async function analyze() {
  console.log('═══════════════════════════════════════════════════');
  console.log('ANALYZING FATURA ENTRIES');
  console.log('═══════════════════════════════════════════════════\n');

  // Get credit card account
  const account = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'))
    .limit(1);

  if (!account[0]) {
    console.error('✗ No credit card account found');
    return;
  }

  const accountId = account[0].id;

  for (const month of ['2025-11', '2025-12', '2026-01']) {
    console.log(`\n📊 Fatura: ${month}`);
    console.log('─────────────────────────────────────────────────\n');

    const entriesData = await db
      .select({
        purchaseDate: entries.purchaseDate,
        description: transactions.description,
        amount: sql<number>`${entries.amount} / 100.0`,
        externalId: transactions.externalId,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .where(
        and(
          eq(entries.accountId, accountId),
          eq(entries.faturaMonth, month)
        )
      )
      .orderBy(entries.purchaseDate);

    const total = entriesData.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);

    console.log(`Total entries: ${entriesData.length}`);
    console.log(`Total amount: R$ ${total.toFixed(2)}`);

    // Show date range
    if (entriesData.length > 0) {
      const dates = entriesData.map(e => e.purchaseDate).filter(Boolean);
      const minDate = dates.reduce((a, b) => (a! < b! ? a : b));
      const maxDate = dates.reduce((a, b) => (a! > b! ? a : b));
      console.log(`Date range: ${minDate} to ${maxDate}`);
    }

    // Show sample entries
    console.log('\nSample entries (first 10):');
    console.table(entriesData.slice(0, 10).map(e => ({
      date: e.purchaseDate,
      desc: e.description,
      amount: parseFloat(e.amount as any).toFixed(2),
    })));

    // Check for duplicates by purchase date
    const dateGroups = new Map<string, typeof entriesData>();
    entriesData.forEach(e => {
      if (!e.purchaseDate) return;
      if (!dateGroups.has(e.purchaseDate)) {
        dateGroups.set(e.purchaseDate, []);
      }
      dateGroups.get(e.purchaseDate)!.push(e);
    });

    // Show dates with multiple entries
    const multiEntryDates = Array.from(dateGroups.entries())
      .filter(([_, entries]) => entries.length > 5)
      .sort((a, b) => b[1].length - a[1].length);

    if (multiEntryDates.length > 0) {
      console.log(`\nDates with many entries (top 5):`);
      multiEntryDates.slice(0, 5).forEach(([date, entries]) => {
        console.log(`  ${date}: ${entries.length} entries`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('ANALYSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

analyze()
  .then(() => {
    console.log('✓ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Analysis failed:', error);
    process.exit(1);
  });
