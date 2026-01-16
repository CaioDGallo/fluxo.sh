/**
 * Backfill script to populate category_frequency table from existing transactions and income
 *
 * Usage: tsx scripts/backfill-category-frequency.ts
 */

import { db } from '@/lib/db';
import { categoryFrequency } from '@/lib/schema';
import { sql } from 'drizzle-orm';

async function backfillCategoryFrequency() {
  console.log('Starting category frequency backfill...\n');

  try {
    // Aggregate expenses from transactions table
    console.log('Aggregating expense frequencies from transactions...');
    const expenseResults = await db.execute<{
      user_id: string;
      description_normalized: string;
      category_id: number;
      count: number;
      last_used_at: Date;
    }>(sql`
      SELECT
        user_id,
        LOWER(TRIM(description)) as description_normalized,
        category_id,
        COUNT(*) as count,
        MAX(created_at) as last_used_at
      FROM transactions
      WHERE ignored = false
      GROUP BY user_id, LOWER(TRIM(description)), category_id
    `);

    console.log(`Found ${expenseResults.rows.length} unique expense patterns\n`);

    // Aggregate income frequencies
    console.log('Aggregating income frequencies from income table...');
    const incomeResults = await db.execute<{
      user_id: string;
      description_normalized: string;
      category_id: number;
      count: number;
      last_used_at: Date;
    }>(sql`
      SELECT
        user_id,
        LOWER(TRIM(description)) as description_normalized,
        category_id,
        COUNT(*) as count,
        MAX(created_at) as last_used_at
      FROM income
      WHERE ignored = false
      GROUP BY user_id, LOWER(TRIM(description)), category_id
    `);

    console.log(`Found ${incomeResults.rows.length} unique income patterns\n`);

    // Insert expense frequencies
    console.log('Inserting expense frequencies...');
    let expenseInserted = 0;
    for (const row of expenseResults.rows) {
      await db
        .insert(categoryFrequency)
        .values({
          userId: row.user_id,
          descriptionNormalized: row.description_normalized,
          categoryId: row.category_id,
          type: 'expense',
          count: Number(row.count),
          lastUsedAt: row.last_used_at,
        })
        .onConflictDoUpdate({
          target: [
            categoryFrequency.userId,
            categoryFrequency.descriptionNormalized,
            categoryFrequency.categoryId,
            categoryFrequency.type,
          ],
          set: {
            count: Number(row.count),
            lastUsedAt: row.last_used_at,
          },
        });
      expenseInserted++;
      if (expenseInserted % 100 === 0) {
        console.log(`  Processed ${expenseInserted}/${expenseResults.rows.length} expense patterns`);
      }
    }
    console.log(`✓ Inserted ${expenseInserted} expense frequency records\n`);

    // Insert income frequencies
    console.log('Inserting income frequencies...');
    let incomeInserted = 0;
    for (const row of incomeResults.rows) {
      await db
        .insert(categoryFrequency)
        .values({
          userId: row.user_id,
          descriptionNormalized: row.description_normalized,
          categoryId: row.category_id,
          type: 'income',
          count: Number(row.count),
          lastUsedAt: row.last_used_at,
        })
        .onConflictDoUpdate({
          target: [
            categoryFrequency.userId,
            categoryFrequency.descriptionNormalized,
            categoryFrequency.categoryId,
            categoryFrequency.type,
          ],
          set: {
            count: Number(row.count),
            lastUsedAt: row.last_used_at,
          },
        });
      incomeInserted++;
      if (incomeInserted % 100 === 0) {
        console.log(`  Processed ${incomeInserted}/${incomeResults.rows.length} income patterns`);
      }
    }
    console.log(`✓ Inserted ${incomeInserted} income frequency records\n`);

    console.log('✓ Backfill completed successfully!');
    console.log(`  Total records: ${expenseInserted + incomeInserted}`);

    process.exit(0);
  } catch (error) {
    console.error('✗ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillCategoryFrequency();
