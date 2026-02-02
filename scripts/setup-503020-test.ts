/**
 * Quick script to set up 50-30-20 budget config and assign buckets to categories
 * Run with: npx tsx scripts/setup-503020-test.ts
 */

import { db } from '@/lib/db';
import { budgetConfig, categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';

async function setup() {
  // Get first user (for testing)
  const [firstCategory] = await db
    .select({ userId: categories.userId })
    .from(categories)
    .limit(1);

  if (!firstCategory) {
    console.log('❌ No categories found. Create some categories first.');
    process.exit(1);
  }

  const userId = firstCategory.userId;
  console.log(`Setting up for user: ${userId}`);

  // 1. Create/update budget config
  const [existingConfig] = await db
    .select()
    .from(budgetConfig)
    .where(eq(budgetConfig.userId, userId))
    .limit(1);

  if (existingConfig) {
    console.log('✓ Budget config already exists:', existingConfig.preset);
  } else {
    await db.insert(budgetConfig).values({
      userId,
      preset: 'na_risca', // 50/30/20
      customNecessities: null,
      customWants: null,
      customSavings: null,
    });
    console.log('✓ Created budget config with "na_risca" preset (50/30/20)');
  }

  // 2. Assign buckets to categories
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const expenseCategories = allCategories.filter((c) => c.type === 'expense');
  console.log(`\nFound ${expenseCategories.length} expense categories`);

  // Auto-assign buckets based on category names (simple heuristic)
  for (const category of expenseCategories) {
    const name = category.name.toLowerCase();
    let bucket: 'necessities' | 'wants' | 'savings' | null = null;

    // Necessities (50%)
    if (
      name.includes('aluguel') ||
      name.includes('moradia') ||
      name.includes('alimentação') ||
      name.includes('transporte') ||
      name.includes('saúde') ||
      name.includes('conta') ||
      name.includes('bill') ||
      name.includes('rent') ||
      name.includes('food') ||
      name.includes('groceries') ||
      name.includes('transport')
    ) {
      bucket = 'necessities';
    }
    // Savings (20%)
    else if (
      name.includes('poupança') ||
      name.includes('investimento') ||
      name.includes('reserva') ||
      name.includes('saving') ||
      name.includes('investment')
    ) {
      bucket = 'savings';
    }
    // Wants (30%)
    else if (
      name.includes('lazer') ||
      name.includes('entretenimento') ||
      name.includes('restaurante') ||
      name.includes('viagem') ||
      name.includes('compras') ||
      name.includes('entertainment') ||
      name.includes('dining') ||
      name.includes('shopping') ||
      name.includes('travel')
    ) {
      bucket = 'wants';
    }

    if (bucket && category.bucket !== bucket) {
      await db
        .update(categories)
        .set({ bucket })
        .where(eq(categories.id, category.id));
      console.log(`  ✓ ${category.name} → ${bucket}`);
    } else if (bucket) {
      console.log(`  - ${category.name} (already ${bucket})`);
    } else {
      console.log(`  ⚠ ${category.name} (unassigned - couldn't auto-detect)`);
    }
  }

  console.log('\n✅ Setup complete! Refresh /settings/budgets to see bucket grouping.');
  console.log('💡 Unassigned categories will show a warning - assign them in /settings/categories');
}

setup()
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
