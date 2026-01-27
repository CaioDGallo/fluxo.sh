import { db } from '@/lib/db';
import { accounts, billingSubscriptions, categories } from '@/lib/schema';
import { DEFAULT_CATEGORIES } from '@/lib/user-setup/default-categories';
import { DEFAULT_PLAN_KEY, PLANS, resolvePlanKey, type PlanKey, type PlanLimits } from '@/lib/plans';
import { and, desc, eq, inArray } from 'drizzle-orm';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

const DEFAULT_CATEGORY_KEYS = new Set(
  DEFAULT_CATEGORIES.map((category) => `${category.type}:${category.name.toLowerCase()}`)
);

export type UserEntitlements = {
  planKey: PlanKey;
  limits: PlanLimits;
};

export async function getUserPlan(userId: string): Promise<PlanKey> {
  const [subscription] = await db
    .select({ planKey: billingSubscriptions.planKey })
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.userId, userId),
        inArray(billingSubscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)
      )
    )
    .orderBy(desc(billingSubscriptions.currentPeriodEnd), desc(billingSubscriptions.createdAt))
    .limit(1);

  return resolvePlanKey(subscription?.planKey ?? DEFAULT_PLAN_KEY);
}

export async function getUserEntitlements(userId: string): Promise<UserEntitlements> {
  const planKey = await getUserPlan(userId);
  return {
    planKey,
    limits: PLANS[planKey].limits,
  };
}

export async function getCustomCategoryCount(userId: string): Promise<number> {
  const rows = await db
    .select({ name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, userId));

  return rows.filter((row) => !DEFAULT_CATEGORY_KEYS.has(`${row.type}:${row.name.toLowerCase()}`)).length;
}

export async function getAccountCounts(userId: string): Promise<{ total: number; creditCards: number }> {
  const rows = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const creditCards = rows.filter((account) => account.type === 'credit_card').length;
  return {
    total: rows.length,
    creditCards,
  };
}
