/**
 * Remove entries that fall outside the OFX date ranges
 *
 * November OFX: 2025-10-12 to 2025-11-01
 * December OFX: 2025-11-02 to 2025-12-01
 * January OFX: 2025-12-02 to 2026-01-01
 */

import { db } from '@/lib/db';
import { accounts, entries, transactions, income, faturas } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

async function removeOutOfRange() {
  console.log('═══════════════════════════════════════════════════');
  console.log('REMOVING OUT-OF-RANGE ENTRIES');
  console.log('═══════════════════════════════════════════════════\n');

  const account = await db
    .select({ id: accounts.id, userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'))
    .limit(1);

  if (!account[0]) {
    console.error('✗ No credit card account found');
    return;
  }

  const { id: accountId, userId } = account[0];

  // November should only have entries from 2025-10-12 to 2025-11-01
  console.log('Step 1: Checking November entries...');

  const novOutOfRange = await db
    .select({
      id: entries.id,
      purchaseDate: entries.purchaseDate,
      description: transactions.description,
      amount: sql<number>`${entries.amount} / 100.0`,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        eq(entries.faturaMonth, '2025-11'),
        sql`${entries.purchaseDate} < '2025-10-12'`
      )
    );

  console.log(`Found ${novOutOfRange.length} November entries before 2025-10-12:`);
  if (novOutOfRange.length > 0) {
    const total = novOutOfRange.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    console.log(`Total amount: R$ ${total.toFixed(2)}`);
    console.table(novOutOfRange.slice(0, 10).map(e => ({
      date: e.purchaseDate,
      desc: e.description?.substring(0, 30),
      amount: parseFloat(e.amount as any).toFixed(2),
    })));

    await db
      .delete(entries)
      .where(
        sql`${entries.id} IN (${sql.join(novOutOfRange.map(e => sql`${e.id}`), sql`, `)})`
      );

    console.log(`✓ Deleted ${novOutOfRange.length} out-of-range entries\n`);
  } else {
    console.log('✓ No out-of-range entries\n');
  }

  // December should only have entries from 2025-11-02 to 2025-12-01
  console.log('Step 2: Checking December entries...');

  const decOutOfRange = await db
    .select({
      id: entries.id,
      purchaseDate: entries.purchaseDate,
      description: transactions.description,
      amount: sql<number>`${entries.amount} / 100.0`,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        eq(entries.faturaMonth, '2025-12'),
        sql`(${entries.purchaseDate} < '2025-11-02' OR ${entries.purchaseDate} > '2025-12-01')`
      )
    );

  console.log(`Found ${decOutOfRange.length} December entries outside 2025-11-02 to 2025-12-01:`);
  if (decOutOfRange.length > 0) {
    const total = decOutOfRange.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    console.log(`Total amount: R$ ${total.toFixed(2)}`);
    console.table(decOutOfRange.slice(0, 10).map(e => ({
      date: e.purchaseDate,
      desc: e.description?.substring(0, 30),
      amount: parseFloat(e.amount as any).toFixed(2),
    })));

    await db
      .delete(entries)
      .where(
        sql`${entries.id} IN (${sql.join(decOutOfRange.map(e => sql`${e.id}`), sql`, `)})`
      );

    console.log(`✓ Deleted ${decOutOfRange.length} out-of-range entries\n`);
  } else {
    console.log('✓ No out-of-range entries\n');
  }

  // January should only have entries from 2025-12-02 to 2026-01-01
  console.log('Step 3: Checking January entries...');

  const janOutOfRange = await db
    .select({
      id: entries.id,
      purchaseDate: entries.purchaseDate,
      description: transactions.description,
      amount: sql<number>`${entries.amount} / 100.0`,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        eq(entries.faturaMonth, '2026-01'),
        sql`(${entries.purchaseDate} < '2025-12-02' OR ${entries.purchaseDate} > '2026-01-01')`
      )
    );

  console.log(`Found ${janOutOfRange.length} January entries outside 2025-12-02 to 2026-01-01:`);
  if (janOutOfRange.length > 0) {
    const total = janOutOfRange.reduce((sum, e) => sum + parseFloat(e.amount as any), 0);
    console.log(`Total amount: R$ ${total.toFixed(2)}`);
    console.table(janOutOfRange.slice(0, 10).map(e => ({
      date: e.purchaseDate,
      desc: e.description?.substring(0, 30),
      amount: parseFloat(e.amount as any).toFixed(2),
    })));

    await db
      .delete(entries)
      .where(
        sql`${entries.id} IN (${sql.join(janOutOfRange.map(e => sql`${e.id}`), sql`, `)})`
      );

    console.log(`✓ Deleted ${janOutOfRange.length} out-of-range entries\n`);
  } else {
    console.log('✓ No out-of-range entries\n');
  }

  // Recalculate all affected faturas
  console.log('Step 4: Recalculating fatura totals...');

  await db.execute(sql`
    UPDATE faturas
    SET total_amount = COALESCE(entries_total, 0) - COALESCE(refunds_total, 0)
    FROM (
      SELECT
        e.user_id,
        e.account_id,
        e.fatura_month AS year_month,
        SUM(e.amount) AS entries_total
      FROM entries e
      WHERE e.user_id = ${userId}
        AND e.account_id = ${accountId}
        AND e.fatura_month IN ('2025-11', '2025-12', '2026-01')
      GROUP BY e.user_id, e.account_id, e.fatura_month
    ) AS entries_agg
    FULL OUTER JOIN (
      SELECT
        i.user_id,
        i.account_id,
        i.fatura_month AS year_month,
        SUM(i.amount) AS refunds_total
      FROM income i
      WHERE i.user_id = ${userId}
        AND i.account_id = ${accountId}
        AND i.fatura_month IN ('2025-11', '2025-12', '2026-01')
      GROUP BY i.user_id, i.account_id, i.fatura_month
    ) AS refunds_agg
    ON entries_agg.user_id = refunds_agg.user_id
      AND entries_agg.account_id = refunds_agg.account_id
      AND entries_agg.year_month = refunds_agg.year_month
    WHERE faturas.user_id = ${userId}
      AND faturas.account_id = ${accountId}
      AND faturas.year_month = COALESCE(entries_agg.year_month, refunds_agg.year_month)
  `);

  console.log('✓ Totals recalculated\n');

  // Final verification
  console.log('Step 5: Final Verification');
  console.log('─────────────────────────────────────────────────\n');

  const finalTotals = await db
    .select({
      yearMonth: faturas.yearMonth,
      totalAmount: sql<number>`${faturas.totalAmount} / 100.0`,
      closingDate: faturas.closingDate,
    })
    .from(faturas)
    .where(
      sql`${faturas.accountId} = ${accountId}
      AND ${faturas.yearMonth} IN ('2025-11', '2025-12', '2026-01')`
    )
    .orderBy(faturas.yearMonth);

  console.table(finalTotals);

  const novTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2025-11')?.totalAmount as any) || 0;
  const decTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2025-12')?.totalAmount as any) || 0;
  const janTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2026-01')?.totalAmount as any) || 0;

  console.log('\n📊 Comparison with OFX LEDGERBAL:');
  console.log(`November:  Expected R$ 5393.38, Got R$ ${novTotal.toFixed(2)} (diff: ${Math.abs(5393.38 - novTotal).toFixed(2)})`);
  console.log(`December:  Expected R$ 7691.23, Got R$ ${decTotal.toFixed(2)} (diff: ${Math.abs(7691.23 - decTotal).toFixed(2)})`);
  console.log(`January:   Expected R$ 4977.14, Got R$ ${janTotal.toFixed(2)} (diff: ${Math.abs(4977.14 - janTotal).toFixed(2)})`);

  const novMatch = Math.abs(5393.38 - novTotal) < 0.01;
  const decMatch = Math.abs(7691.23 - decTotal) < 0.01;
  const janMatch = Math.abs(4977.14 - janTotal) < 0.01;

  if (novMatch && decMatch && janMatch) {
    console.log('\n✅ SUCCESS! All fatura totals now match OFX!');
  } else {
    console.log('\n⚠️  Some discrepancies remain');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('FIX COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

removeOutOfRange()
  .then(() => {
    console.log('✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Script failed:', error);
    process.exit(1);
  });
