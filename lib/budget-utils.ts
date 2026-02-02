import type { BucketType, PresetType } from '@/lib/actions/budget-503020';

// Preset configurations
const PRESETS = {
  na_risca: { necessities: 50, wants: 30, savings: 20 },
  entrando_na_linha: { necessities: 60, wants: 30, savings: 10 },
} as const;

export type BudgetRow = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  categoryBucket: BucketType | null;
  budgetAmount: number | null;
};

export type BucketGroup = {
  bucket: BucketType;
  categories: BudgetRow[];
  allocatedAmount: number; // cents
  targetAmount: number; // cents
  targetPercentage: number; // 0-100
};

export type BudgetPercentages = {
  necessities: number;
  wants: number;
  savings: number;
};

export type GroupedBudgets = {
  groups: BucketGroup[];
  unassigned: BudgetRow[];
  bucketTargets: Record<BucketType, number>;
};

/**
 * Groups budgets by bucket and calculates allocation vs targets
 *
 * @param budgets - Array of budget rows with bucket assignments
 * @param totalBudget - Total monthly budget in cents
 * @param percentages - Percentage allocation per bucket (e.g., {necessities: 50, wants: 30, savings: 20})
 * @returns Grouped budgets with allocation calculations
 */
export function groupBudgetsByBucket(
  budgets: BudgetRow[],
  totalBudget: number,
  percentages: BudgetPercentages
): GroupedBudgets {
  // Separate unassigned categories
  const unassigned = budgets.filter((b) => !b.categoryBucket);
  const assigned = budgets.filter((b) => b.categoryBucket);

  // Group by bucket
  const byBucket: Record<BucketType, BudgetRow[]> = {
    necessities: [],
    wants: [],
    savings: [],
  };

  assigned.forEach((budget) => {
    if (budget.categoryBucket) {
      byBucket[budget.categoryBucket].push(budget);
    }
  });

  // Calculate targets
  const bucketTargets: Record<BucketType, number> = {
    necessities: Math.round((totalBudget * percentages.necessities) / 100),
    wants: Math.round((totalBudget * percentages.wants) / 100),
    savings: Math.round((totalBudget * percentages.savings) / 100),
  };

  // Build groups with allocations
  const buckets: BucketType[] = ['necessities', 'wants', 'savings'];
  const groups: BucketGroup[] = buckets.map((bucket) => {
    const categories = byBucket[bucket];
    const allocatedAmount = categories.reduce(
      (sum, cat) => sum + (cat.budgetAmount ?? 0),
      0
    );

    return {
      bucket,
      categories,
      allocatedAmount,
      targetAmount: bucketTargets[bucket],
      targetPercentage: percentages[bucket],
    };
  });

  return {
    groups,
    unassigned,
    bucketTargets,
  };
}

/**
 * Converts budget config from database to BudgetPercentages
 *
 * @param config - Budget configuration from database (or null if not set)
 * @returns BudgetPercentages or null if config not set
 */
export function getBudgetPercentages(config: {
  preset: PresetType;
  customNecessities: number | null;
  customWants: number | null;
  customSavings: number | null;
} | null): BudgetPercentages | null {
  if (!config) return null;

  if (config.preset === 'custom') {
    if (
      config.customNecessities === null ||
      config.customWants === null ||
      config.customSavings === null
    ) {
      // Invalid custom config, fall back to default
      return PRESETS.na_risca;
    }
    return {
      necessities: config.customNecessities,
      wants: config.customWants,
      savings: config.customSavings,
    };
  }

  return PRESETS[config.preset] ?? PRESETS.na_risca;
}
