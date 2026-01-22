/**
 * Re-import missing transactions with correct fatura months
 *
 * Key insight: Transactions in December OFX belong to December fatura (2025-12),
 * not to the month calculated from account closingDay.
 */

import { db } from '@/lib/db';
import { accounts, transactions, entries, faturas, income } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getFaturaPaymentDueDate } from '@/lib/fatura-utils';

async function reimport() {
  console.log('═══════════════════════════════════════════════════');
  console.log('FIXING FATURA MONTH ASSIGNMENTS');
  console.log('═══════════════════════════════════════════════════\n');

  // Get account info
  const account = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      closingDay: accounts.closingDay,
      paymentDueDay: accounts.paymentDueDay,
    })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'))
    .limit(1);

  if (!account[0]) {
    console.error('✗ No credit card account found');
    return;
  }

  const { id: accountId, userId, closingDay, paymentDueDay } = account[0];

  // Step 1: Delete the incorrectly imported entries from 2025-11
  console.log('Step 1: Removing incorrectly assigned entries...');

  const wrongEntries = await db
    .select({
      id: entries.id,
      description: transactions.description,
      faturaMonth: entries.faturaMonth,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        eq(entries.faturaMonth, '2025-11'),
        sql`${entries.purchaseDate} = '2025-11-01'`
      )
    );

  console.log(`Found ${wrongEntries.length} entries in wrong fatura (2025-11):`);
  console.table(wrongEntries.map(e => ({ desc: e.description })));

  if (wrongEntries.length > 0) {
    await db
      .delete(entries)
      .where(
        sql`${entries.id} IN (${sql.join(wrongEntries.map(e => sql`${e.id}`), sql`, `)})`
      );
    console.log(`✓ Deleted ${wrongEntries.length} entries\n`);
  }

  // Step 2: Update all entries dated 2025-11-01 to be in December fatura
  console.log('Step 2: Reassigning 2025-11-01 entries to December...');

  const toReassign = await db
    .select({
      id: entries.id,
      description: transactions.description,
      faturaMonth: entries.faturaMonth,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        sql`${entries.purchaseDate} = '2025-11-01'`,
        sql`${entries.faturaMonth} != '2025-12'`
      )
    );

  console.log(`Found ${toReassign.length} entries to reassign:`);
  console.table(toReassign.map(e => ({ desc: e.description, current: e.faturaMonth })));

  if (toReassign.length > 0) {
    // Get December fatura dates
    const decFatura = await db
      .select({
        dueDate: faturas.dueDate,
      })
      .from(faturas)
      .where(
        and(
          eq(faturas.accountId, accountId),
          eq(faturas.yearMonth, '2025-12')
        )
      )
      .limit(1);

    const dueDate = decFatura[0]?.dueDate || '2025-12-04';

    await db
      .update(entries)
      .set({
        faturaMonth: '2025-12',
        dueDate,
      })
      .where(
        sql`${entries.id} IN (${sql.join(toReassign.map(e => sql`${e.id}`), sql`, `)})`
      );

    console.log(`✓ Reassigned ${toReassign.length} entries to December\n`);
  }

  // Step 3: Update all entries dated 2025-12-01 to be in December fatura
  console.log('Step 3: Reassigning 2025-12-01 entries to December...');

  const dec01Entries = await db
    .select({
      id: entries.id,
      description: transactions.description,
      faturaMonth: entries.faturaMonth,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.accountId, accountId),
        sql`${entries.purchaseDate} = '2025-12-01'`,
        sql`${entries.faturaMonth} != '2025-12'`
      )
    );

  console.log(`Found ${dec01Entries.length} entries dated 2025-12-01 in wrong fatura:`);
  console.table(dec01Entries.map(e => ({ desc: e.description, current: e.faturaMonth })));

  if (dec01Entries.length > 0) {
    const decFatura = await db
      .select({
        dueDate: faturas.dueDate,
      })
      .from(faturas)
      .where(
        and(
          eq(faturas.accountId, accountId),
          eq(faturas.yearMonth, '2025-12')
        )
      )
      .limit(1);

    const dueDate = decFatura[0]?.dueDate || '2025-12-04';

    await db
      .update(entries)
      .set({
        faturaMonth: '2025-12',
        dueDate,
      })
      .where(
        sql`${entries.id} IN (${sql.join(dec01Entries.map(e => sql`${e.id}`), sql`, `)})`
      );

    console.log(`✓ Reassigned ${dec01Entries.length} entries to December\n`);
  }

  // Step 4: Recalculate all affected faturas
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

  // Step 5: Final verification
  console.log('Step 5: Final Verification');
  console.log('─────────────────────────────────────────────────\n');

  const finalTotals = await db
    .select({
      yearMonth: faturas.yearMonth,
      totalAmount: sql<number>`${faturas.totalAmount} / 100.0`,
      closingDate: faturas.closingDate,
      startDate: faturas.startDate,
    })
    .from(faturas)
    .where(
      sql`${faturas.accountId} = ${accountId}
      AND ${faturas.yearMonth} IN ('2025-11', '2025-12', '2026-01')`
    )
    .orderBy(faturas.yearMonth);

  console.table(finalTotals);

  const decTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2025-12')?.totalAmount as any) || 0;
  const janTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2026-01')?.totalAmount as any) || 0;

  console.log('\n📊 Comparison with OFX LEDGERBAL:');
  console.log('December: Expected R$ 7691.23, Got R$ ' + decTotal.toFixed(2) + ' (diff: ' + (7691.23 - decTotal).toFixed(2) + ')');
  console.log('January:  Expected R$ 4977.14, Got R$ ' + janTotal.toFixed(2) + ' (diff: ' + (4977.14 - janTotal).toFixed(2) + ')');

  const decMatch = Math.abs(7691.23 - decTotal) < 0.01;
  const janMatch = Math.abs(4977.14 - janTotal) < 0.01;

  if (decMatch && janMatch) {
    console.log('\n✅ SUCCESS! Fatura totals now match OFX!');
  } else {
    console.log('\n⚠️  Discrepancies remain');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('FIX COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

reimport()
  .then(() => {
    console.log('✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Script failed:', error);
    process.exit(1);
  });
