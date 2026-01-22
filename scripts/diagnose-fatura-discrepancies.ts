/**
 * Diagnostic script to identify why December/January fatura totals don't match OFX
 *
 * Expected totals from OFX LEDGERBAL:
 * - December 2025: 7691.23 (App shows: 7491.22) - Missing 200.01
 * - January 2026: 4977.14 (App shows: 4803.94) - Missing 173.20
 */

import { db } from '@/lib/db';
import { accounts, entries, faturas, income, transactions } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

async function diagnose() {
  console.log('═══════════════════════════════════════════════════');
  console.log('FATURA DISCREPANCY DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════\n');

  // Query 1: Check stored fatura totals
  console.log('📊 Query 1: Stored Fatura Totals');
  console.log('─────────────────────────────────────────────────\n');

  const storedTotals = await db
    .select({
      yearMonth: faturas.yearMonth,
      storedTotal: sql<number>`${faturas.totalAmount} / 100.0`,
      closingDate: faturas.closingDate,
      accountName: accounts.name,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id))
    .where(
      and(
        sql`${faturas.yearMonth} IN ('2025-12', '2026-01')`,
        eq(accounts.type, 'credit_card')
      )
    );

  console.table(storedTotals);

  // Query 2: Calculate actual totals from entries and income
  console.log('\n📊 Query 2: Calculated Totals from Entries + Income');
  console.log('─────────────────────────────────────────────────\n');

  for (const month of ['2025-12', '2026-01']) {
    const entriesTotal = await db
      .select({
        total: sql<number>`COALESCE(SUM(${entries.amount}), 0) / 100.0`,
      })
      .from(entries)
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(
        and(
          eq(accounts.type, 'credit_card'),
          eq(entries.faturaMonth, month)
        )
      );

    const refundsTotal = await db
      .select({
        total: sql<number>`COALESCE(SUM(${income.amount}), 0) / 100.0`,
      })
      .from(income)
      .innerJoin(accounts, eq(income.accountId, accounts.id))
      .where(
        and(
          eq(accounts.type, 'credit_card'),
          eq(income.faturaMonth, month)
        )
      );

    const entries_val = parseFloat(entriesTotal[0]?.total as any) || 0;
    const refunds_val = parseFloat(refundsTotal[0]?.total as any) || 0;
    const net = entries_val - refunds_val;

    console.log(`${month}:`);
    console.log(`  Entries Total:  R$ ${entries_val.toFixed(2)}`);
    console.log(`  Refunds Total:  R$ ${refunds_val.toFixed(2)}`);
    console.log(`  Net Total:      R$ ${net.toFixed(2)}`);
    console.log('');
  }

  // Query 3: Check "Limite convertido" transactions
  console.log('\n📊 Query 3: "Limite convertido" Transactions');
  console.log('─────────────────────────────────────────────────\n');

  const limiteConvertido = await db
    .select({
      description: transactions.description,
      amount: sql<number>`${transactions.totalAmount} / 100.0`,
      faturaMonth: entries.faturaMonth,
      purchaseDate: entries.purchaseDate,
    })
    .from(transactions)
    .innerJoin(entries, eq(transactions.id, entries.transactionId))
    .where(sql`LOWER(${transactions.description}) LIKE '%limite convertido%'`);

  if (limiteConvertido.length > 0) {
    console.table(limiteConvertido);
  } else {
    console.log('No "Limite convertido" transactions found.\n');
  }

  // Query 4: Find entries with wrong fatura_month
  console.log('\n📊 Query 4: Entries with Potential Wrong fatura_month');
  console.log('─────────────────────────────────────────────────\n');

  // Dec OFX covers Nov 1 - Dec 1, should all be fatura 2025-12
  const wrongDecEntries = await db
    .select({
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
        sql`${entries.purchaseDate} BETWEEN '2025-11-01' AND '2025-12-01'`,
        sql`${entries.faturaMonth} != '2025-12'`
      )
    );

  if (wrongDecEntries.length > 0) {
    console.log('Entries with purchase dates Nov 1 - Dec 1 but NOT in 2025-12:');
    console.table(wrongDecEntries);
  } else {
    console.log('✓ All Nov 1 - Dec 1 entries are correctly in 2025-12\n');
  }

  // Jan OFX covers Dec 2 - Jan 1, should all be fatura 2026-01
  const wrongJanEntries = await db
    .select({
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
        sql`${entries.purchaseDate} BETWEEN '2025-12-02' AND '2026-01-01'`,
        sql`${entries.faturaMonth} != '2026-01'`
      )
    );

  if (wrongJanEntries.length > 0) {
    console.log('\nEntries with purchase dates Dec 2 - Jan 1 but NOT in 2026-01:');
    console.table(wrongJanEntries);
  } else {
    console.log('✓ All Dec 2 - Jan 1 entries are correctly in 2026-01\n');
  }

  // Query 5: Check income/refunds attribution
  console.log('\n📊 Query 5: Income/Refunds Attribution');
  console.log('─────────────────────────────────────────────────\n');

  const refunds = await db
    .select({
      faturaMonth: income.faturaMonth,
      receivedDate: income.receivedDate,
      amount: sql<number>`${income.amount} / 100.0`,
      description: income.description,
    })
    .from(income)
    .innerJoin(accounts, eq(income.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'credit_card'),
        sql`${income.receivedDate} BETWEEN '2025-11-01' AND '2026-02-01'`
      )
    );

  if (refunds.length > 0) {
    console.table(refunds);
  } else {
    console.log('No refunds found in the period.\n');
  }

  // Additional check: Count total entries per month
  console.log('\n📊 Additional: Entry Count Per Month');
  console.log('─────────────────────────────────────────────────\n');

  const entryCounts = await db
    .select({
      faturaMonth: entries.faturaMonth,
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`SUM(${entries.amount}) / 100.0`,
    })
    .from(entries)
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'credit_card'),
        sql`${entries.faturaMonth} IN ('2025-12', '2026-01')`
      )
    )
    .groupBy(entries.faturaMonth);

  console.table(entryCounts);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

diagnose()
  .then(() => {
    console.log('✓ Diagnostics finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Diagnostic failed:', error);
    process.exit(1);
  });
