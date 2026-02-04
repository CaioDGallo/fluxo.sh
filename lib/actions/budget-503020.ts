'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import {
  categories,
  budgets,
  transactions,
  entries,
  budgetConfig,
} from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { parseYearMonth } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { handleDbError } from '@/lib/db-errors';
import { guardCrudOperation } from '@/lib/rate-limit-guard';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// Preset configurations
const PRESETS = {
  na_risca: { necessities: 50, wants: 30, savings: 20 },
  entrando_na_linha: { necessities: 60, wants: 30, savings: 10 },
  saindo_das_dividas: { necessities: 70, wants: 25, savings: 5 },
} as const;

export type BucketType = 'necessities' | 'wants' | 'savings';
export type PresetType = 'na_risca' | 'entrando_na_linha' | 'saindo_das_dividas' | 'custom';

export interface BucketData {
  bucket: BucketType;
  spent: number; // cents
  target: number; // cents
  percentage: number; // 0-100
}

export interface PacingData {
  status: 'on_track' | 'over_pace' | 'under_pace';
  percentageOfExpected: number; // e.g., 105 means 5% over pace
}

export interface SafeToSpendData {
  buckets: BucketData[];
  wantsSafeToSpend: number; // cents remaining in wants bucket
  wantsSafeToSpendDaily: number; // cents per day
  daysRemaining: number;
  pacing: PacingData;
  totalBudget: number; // cents
  totalSpent: number; // cents
}

/**
 * Extract bucket percentages from config
 */
function getBucketPercentages(
  config: { preset: PresetType; customNecessities: number | null; customWants: number | null; customSavings: number | null } | undefined
): { necessities: number; wants: number; savings: number } {
  const preset = config?.preset ?? 'na_risca';

  if (preset === 'custom' && config) {
    return {
      necessities: config.customNecessities ?? 50,
      wants: config.customWants ?? 30,
      savings: config.customSavings ?? 20,
    };
  }

  return PRESETS[preset as keyof typeof PRESETS];
}

/**
 * Calculate bucket targets from total budget and percentages
 */
function calculateBucketTargets(
  totalBudget: number,
  percentages: { necessities: number; wants: number; savings: number }
): { necessitiesTarget: number; wantsTarget: number; savingsTarget: number } {
  return {
    necessitiesTarget: Math.round(totalBudget * percentages.necessities / 100),
    wantsTarget: Math.round(totalBudget * percentages.wants / 100),
    savingsTarget: Math.round(totalBudget * percentages.savings / 100),
  };
}

/**
 * Calculate pacing status for wants bucket
 */
function calculatePacing(
  wantsSpent: number,
  wantsTarget: number,
  yearMonth: string
): { pacingStatus: 'on_track' | 'over_pace' | 'under_pace'; pacingPercent: number; daysRemaining: number } {
  const monthStart = parseYearMonth(yearMonth);
  const now = new Date();
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const totalDays = monthEnd.getDate();
  const currentDay = now.getMonth() === monthStart.getMonth() &&
                     now.getFullYear() === monthStart.getFullYear()
                     ? now.getDate()
                     : monthStart > now
                       ? 0          // Future month: no days passed
                       : totalDays; // Past month: all days passed
  const daysRemaining = Math.max(0, totalDays - currentDay);
  const daysPassed = currentDay;

  const expectedWantsSpent = daysPassed > 0 ? (wantsTarget * daysPassed) / totalDays : 0;
  const pacingPercent = expectedWantsSpent > 0 ? (wantsSpent / expectedWantsSpent) * 100 : 0;

  let pacingStatus: 'on_track' | 'over_pace' | 'under_pace' = 'on_track';
  if (pacingPercent > 110) pacingStatus = 'over_pace';
  else if (pacingPercent < 90) pacingStatus = 'under_pace';

  return { pacingStatus, pacingPercent, daysRemaining };
}

/**
 * Get 50/30/20 budget data for a specific month
 */
export const getSafeToSpendData = cache(async (yearMonth: string): Promise<SafeToSpendData> => {
  try {
    const userId = await getCurrentUserId();

    // Get user's budget config (or use default preset)
    const [config] = await db
      .select()
      .from(budgetConfig)
      .where(eq(budgetConfig.userId, userId))
      .limit(1);

    const percentages = getBucketPercentages(config);

    // Get total monthly budget
    const budgetRows = await db
      .select({
        categoryId: budgets.categoryId,
        amount: budgets.amount,
        bucket: categories.bucket,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(
        eq(budgets.userId, userId),
        eq(budgets.yearMonth, yearMonth)
      ));

    const totalBudget = budgetRows.reduce((sum, row) => sum + row.amount, 0);

    // Get spending by bucket for this month
    const spendingRows = await db
      .select({
        bucket: categories.bucket,
        totalSpent: sql<number>`COALESCE(SUM(${entries.amount}), 0)`.as('total_spent'),
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        eq(entries.userId, userId),
        sql`TO_CHAR(${entries.purchaseDate}, 'YYYY-MM') = ${yearMonth}`,
        eq(transactions.ignored, false)
      ))
      .groupBy(categories.bucket);

    // Calculate bucket targets and spent
    const bucketMap = new Map<BucketType | null, number>();
    for (const row of spendingRows) {
      bucketMap.set(row.bucket as BucketType | null, Number(row.totalSpent));
    }

    // Treat unassigned categories as "wants" (conservative fallback)
    const unassignedSpent = bucketMap.get(null) ?? 0;
    const necessitiesSpent = (bucketMap.get('necessities') ?? 0);
    const wantsSpent = (bucketMap.get('wants') ?? 0) + unassignedSpent;
    const savingsSpent = bucketMap.get('savings') ?? 0;

    const { necessitiesTarget, wantsTarget, savingsTarget } = calculateBucketTargets(totalBudget, percentages);
    const totalSpent = necessitiesSpent + wantsSpent + savingsSpent;

    // Calculate pacing for wants bucket
    const { pacingStatus, pacingPercent, daysRemaining } = calculatePacing(wantsSpent, wantsTarget, yearMonth);

    const wantsSafeToSpend = Math.max(0, wantsTarget - wantsSpent);
    const wantsSafeToSpendDaily = daysRemaining > 0 ? Math.round(wantsSafeToSpend / daysRemaining) : 0;

    const buckets: BucketData[] = [
      {
        bucket: 'necessities',
        spent: necessitiesSpent,
        target: necessitiesTarget,
        percentage: necessitiesTarget > 0 ? Math.round((necessitiesSpent / necessitiesTarget) * 100) : 0,
      },
      {
        bucket: 'wants',
        spent: wantsSpent,
        target: wantsTarget,
        percentage: wantsTarget > 0 ? Math.round((wantsSpent / wantsTarget) * 100) : 0,
      },
      {
        bucket: 'savings',
        spent: savingsSpent,
        target: savingsTarget,
        percentage: savingsTarget > 0 ? Math.round((savingsSpent / savingsTarget) * 100) : 0,
      },
    ];

    return {
      buckets,
      wantsSafeToSpend,
      wantsSafeToSpendDaily,
      daysRemaining,
      pacing: {
        status: pacingStatus,
        percentageOfExpected: Math.round(pacingPercent),
      },
      totalBudget,
      totalSpent,
    };
  } catch (error) {
    logError(
      'SAFE_TO_SPEND_CALCULATION_FAILED',
      'Failed to calculate safe-to-spend data',
      error,
      { yearMonth }
    );

    // Return safe fallback data so dashboard doesn't crash
    return {
      buckets: [
        { bucket: 'necessities', spent: 0, target: 0, percentage: 0 },
        { bucket: 'wants', spent: 0, target: 0, percentage: 0 },
        { bucket: 'savings', spent: 0, target: 0, percentage: 0 },
      ],
      wantsSafeToSpend: 0,
      wantsSafeToSpendDaily: 0,
      daysRemaining: 0,
      pacing: { status: 'on_track', percentageOfExpected: 0 },
      totalBudget: 0,
      totalSpent: 0,
    };
  }
});

/**
 * Update a category's budget bucket assignment
 */
export async function updateCategoryBucket(
  categoryId: number,
  bucket: BucketType | null
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    // Verify category ownership
    const [category] = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.id, categoryId),
        eq(categories.userId, userId)
      ))
      .limit(1);

    if (!category) {
      return { success: false, error: 'Category not found' };
    }

    // Update bucket
    await db
      .update(categories)
      .set({ bucket })
      .where(eq(categories.id, categoryId));

    revalidatePath('/dashboard');
    revalidatePath('/settings/categories');

    return { success: true };
  } catch (error) {
    logError(
      'BUCKET_UPDATE_FAILED',
      'Failed to update category bucket assignment',
      error,
      { categoryId, bucket }
    );
    return {
      success: false,
      error: await handleDbError(error, 'errors.failedToUpdateCategoryBucket'),
    };
  }
}

/**
 * Get user's budget config
 */
export const getBudgetConfig = cache(async () => {
  const userId = await getCurrentUserId();

  const [config] = await db
    .select()
    .from(budgetConfig)
    .where(eq(budgetConfig.userId, userId))
    .limit(1);

  return config ?? null;
});

/**
 * Update or create user's budget config
 */
export async function updateBudgetConfig(
  preset: PresetType,
  customPercentages?: { necessities: number; wants: number; savings: number }
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    // Validate custom percentages if custom preset
    if (preset === 'custom') {
      if (!customPercentages) {
        return { success: false, error: 'Custom percentages required for custom preset' };
      }
      const total = customPercentages.necessities + customPercentages.wants + customPercentages.savings;
      if (total !== 100) {
        return { success: false, error: 'Percentages must sum to 100' };
      }
    }

    // Check if config exists
    const [existing] = await db
      .select()
      .from(budgetConfig)
      .where(eq(budgetConfig.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(budgetConfig)
        .set({
          preset,
          customNecessities: customPercentages?.necessities ?? null,
          customWants: customPercentages?.wants ?? null,
          customSavings: customPercentages?.savings ?? null,
        })
        .where(eq(budgetConfig.userId, userId));
    } else {
      // Create new
      await db.insert(budgetConfig).values({
        userId,
        preset,
        customNecessities: customPercentages?.necessities ?? null,
        customWants: customPercentages?.wants ?? null,
        customSavings: customPercentages?.savings ?? null,
      });
    }

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    logError(
      'BUDGET_CONFIG_UPDATE_FAILED',
      'Failed to update budget configuration',
      error,
      { preset, hasCustomPercentages: !!customPercentages }
    );
    return {
      success: false,
      error: await handleDbError(error, 'errors.failedToUpdateBudgetConfig'),
    };
  }
}
