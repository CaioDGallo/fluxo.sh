/**
 * Fix fatura discrepancies for December 2025 and January 2026
 *
 * Issues:
 * 1. January fatura startDate is 2025-12-01, should be 2025-12-02
 * 2. 3 entries dated 2025-12-01 are in 2026-01 fatura, should be in 2025-12
 * 3. Fatura totals need recalculation
 */

import { db } from '@/lib/db';
import { entries, faturas, accounts, income } from '@/lib/schema';
import { and, eq, sql, inArray } from 'drizzle-orm';

async function fix() {
  console.log('═══════════════════════════════════════════════════');
  console.log('FIXING FATURA DISCREPANCIES');
  console.log('═══════════════════════════════════════════════════\n');

  // Get the credit card account ID
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
  console.log(`✓ Found credit card account ID: ${accountId}\n`);

  // Step 1: Fix January fatura startDate
  console.log('Step 1: Fixing January fatura startDate...');
  const janFatura = await db
    .select()
    .from(faturas)
    .where(
      and(
        eq(faturas.accountId, accountId),
        eq(faturas.yearMonth, '2026-01')
      )
    )
    .limit(1);

  if (!janFatura[0]) {
    console.error('✗ January fatura not found');
    return;
  }

  console.log(`  Current startDate: ${janFatura[0].startDate}`);
  console.log(`  Correct startDate: 2025-12-02`);

  await db
    .update(faturas)
    .set({ startDate: '2025-12-02' })
    .where(eq(faturas.id, janFatura[0].id));

  console.log('✓ January startDate updated to 2025-12-02\n');

  // Step 2: Move 3 misplaced entries from 2026-01 to 2025-12
  console.log('Step 2: Moving misplaced entries...');

  const misplacedEntries = await db
    .select({ id: entries.id, amount: entries.amount })
    .from(entries)
    .where(
      and(
        eq(entries.accountId, accountId),
        eq(entries.purchaseDate, '2025-12-01'),
        eq(entries.faturaMonth, '2026-01')
      )
    );

  console.log(`  Found ${misplacedEntries.length} entries to move`);

  if (misplacedEntries.length > 0) {
    const entryIds = misplacedEntries.map(e => e.id);
    await db
      .update(entries)
      .set({ faturaMonth: '2025-12' })
      .where(inArray(entries.id, entryIds));

    const totalMoved = misplacedEntries.reduce((sum, e) => sum + e.amount, 0) / 100;
    console.log(`✓ Moved ${misplacedEntries.length} entries (R$ ${totalMoved.toFixed(2)}) to December\n`);
  }

  // Step 3: Recalculate fatura totals
  console.log('Step 3: Recalculating fatura totals...');

  // Get userId from account
  const accountWithUser = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const userId = accountWithUser[0]?.userId;
  if (!userId) {
    console.error('✗ Could not find userId');
    return;
  }

  // Recalculate December fatura
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
        AND e.fatura_month IN ('2025-12', '2026-01')
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
        AND i.fatura_month IN ('2025-12', '2026-01')
      GROUP BY i.user_id, i.account_id, i.fatura_month
    ) AS refunds_agg
    ON entries_agg.user_id = refunds_agg.user_id
      AND entries_agg.account_id = refunds_agg.account_id
      AND entries_agg.year_month = refunds_agg.year_month
    WHERE faturas.user_id = ${userId}
      AND faturas.account_id = ${accountId}
      AND faturas.year_month = COALESCE(entries_agg.year_month, refunds_agg.year_month)
  `);

  console.log('✓ Fatura totals recalculated\n');

  // Step 4: Verify the fix
  console.log('Step 4: Verifying fix...');

  const updatedTotals = await db
    .select({
      yearMonth: faturas.yearMonth,
      totalAmount: sql<number>`${faturas.totalAmount} / 100.0`,
      closingDate: faturas.closingDate,
      startDate: faturas.startDate,
    })
    .from(faturas)
    .where(
      and(
        eq(faturas.accountId, accountId),
        sql`${faturas.yearMonth} IN ('2025-12', '2026-01')`
      )
    );

  console.table(updatedTotals);

  // Calculate expected vs actual
  const decTotal = parseFloat(updatedTotals.find(f => f.yearMonth === '2025-12')?.totalAmount as any) || 0;
  const janTotal = parseFloat(updatedTotals.find(f => f.yearMonth === '2026-01')?.totalAmount as any) || 0;

  console.log('\n📊 Comparison with OFX LEDGERBAL:');
  console.log('─────────────────────────────────────────────────');
  console.log(`December 2025:`);
  console.log(`  Expected (OFX): R$ 7691.23`);
  console.log(`  Actual (DB):    R$ ${decTotal.toFixed(2)}`);
  console.log(`  Difference:     R$ ${(7691.23 - decTotal).toFixed(2)}`);
  console.log('');
  console.log(`January 2026:`);
  console.log(`  Expected (OFX): R$ 4977.14`);
  console.log(`  Actual (DB):    R$ ${janTotal.toFixed(2)}`);
  console.log(`  Difference:     R$ ${(4977.14 - janTotal).toFixed(2)}`);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('FIX COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');

  // If still missing transactions, recommend re-import
  if (Math.abs(7691.23 - decTotal) > 0.01 || Math.abs(4977.14 - janTotal) > 0.01) {
    console.log('⚠️  Discrepancies still exist. Re-importing OFX files recommended.');
  }
}

fix()
  .then(() => {
    console.log('✓ Fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Fix failed:', error);
    process.exit(1);
  });
