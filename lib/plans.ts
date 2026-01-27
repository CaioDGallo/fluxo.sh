export const PLAN_KEYS = ['free', 'pro'] as const;

export type PlanKey = typeof PLAN_KEYS[number];

export type PlanLimits = {
  maxCategories: number;
  maxAccounts: number;
  maxCreditCards: number;
  importWeekly: number;
  budgetAlertThresholds: number[];
  customBudgetAlerts: boolean;
};

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  limits: PlanLimits;
};

export const DEFAULT_PLAN_KEY: PlanKey = 'free';

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    limits: {
      maxCategories: 6,
      maxAccounts: 3,
      maxCreditCards: 2,
      importWeekly: 3,
      budgetAlertThresholds: [100, 120],
      customBudgetAlerts: false,
    },
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    limits: {
      maxCategories: 200,
      maxAccounts: 50,
      maxCreditCards: 20,
      importWeekly: 100,
      budgetAlertThresholds: [80, 100, 120],
      customBudgetAlerts: true,
    },
  },
};

export function resolvePlanKey(value?: string | null): PlanKey {
  if (!value) return DEFAULT_PLAN_KEY;
  return PLAN_KEYS.includes(value as PlanKey) ? (value as PlanKey) : DEFAULT_PLAN_KEY;
}

export function getPlanDefinition(value?: string | null): PlanDefinition {
  return PLANS[resolvePlanKey(value)];
}
