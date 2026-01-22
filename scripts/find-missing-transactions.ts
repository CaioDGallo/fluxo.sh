/**
 * Compare OFX files with database to find missing transactions
 */

import { db } from '@/lib/db';
import { transactions, entries, accounts } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { parseOFX } from '@/lib/import/parsers/ofx-parser';

async function findMissing() {
  console.log('═══════════════════════════════════════════════════');
  console.log('FINDING MISSING TRANSACTIONS');
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

  // Get all existing external IDs from database
  const existingTransactions = await db
    .select({
      externalId: transactions.externalId,
      description: transactions.description,
      amount: sql<number>`${transactions.totalAmount} / 100.0`,
    })
    .from(transactions)
    .where(sql`${transactions.externalId} IS NOT NULL`);

  const existingIds = new Set(existingTransactions.map(t => t.externalId));

  console.log(`Database has ${existingIds.size} transactions with externalId\n`);

  // Parse December OFX
  console.log('📄 December OFX (Nubank_2025-12-08.ofx)');
  console.log('─────────────────────────────────────────────────\n');

  const decOfx = readFileSync('Nubank_2025-12-08.ofx', 'utf-8');
  const decParsed = parseOFX(decOfx);

  const decMissing: any[] = [];
  let decTotal = 0;

  decParsed.transactions.forEach(txn => {
    if (!existingIds.has(txn.externalId)) {
      decMissing.push({
        date: txn.date,
        description: txn.description,
        amount: txn.amount / 100,
        externalId: txn.externalId,
      });
      if (txn.amount < 0) { // Expense
        decTotal += Math.abs(txn.amount);
      } else { // Income/Refund
        decTotal -= txn.amount;
      }
    }
  });

  if (decMissing.length > 0) {
    console.log(`Missing ${decMissing.length} transactions:`);
    console.table(decMissing.slice(0, 20)); // Show first 20
    console.log(`\nTotal impact: R$ ${(decTotal / 100).toFixed(2)}\n`);
  } else {
    console.log('✓ No missing transactions\n');
  }

  // Parse January OFX
  console.log('📄 January OFX (Nubank_2026-01-08.ofx)');
  console.log('─────────────────────────────────────────────────\n');

  const janOfx = readFileSync('Nubank_2026-01-08.ofx', 'utf-8');
  const janParsed = parseOFX(janOfx);

  const janMissing: any[] = [];
  let janTotal = 0;

  janParsed.transactions.forEach(txn => {
    if (!existingIds.has(txn.externalId)) {
      janMissing.push({
        date: txn.date,
        description: txn.description,
        amount: txn.amount / 100,
        externalId: txn.externalId,
      });
      if (txn.amount < 0) { // Expense
        janTotal += Math.abs(txn.amount);
      } else { // Income/Refund
        janTotal -= txn.amount;
      }
    }
  });

  if (janMissing.length > 0) {
    console.log(`Missing ${janMissing.length} transactions:`);
    console.table(janMissing.slice(0, 20)); // Show first 20
    console.log(`\nTotal impact: R$ ${(janTotal / 100).toFixed(2)}\n`);
  } else {
    console.log('✓ No missing transactions\n');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('ANALYSIS COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('📊 Summary:');
  console.log(`December missing transactions: ${decMissing.length} (R$ ${(decTotal / 100).toFixed(2)})`);
  console.log(`January missing transactions: ${janMissing.length} (R$ ${(janTotal / 100).toFixed(2)})`);
}

findMissing()
  .then(() => {
    console.log('\n✓ Analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Analysis failed:', error);
    process.exit(1);
  });
