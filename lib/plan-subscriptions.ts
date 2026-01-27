import { db } from '@/lib/db';
import { billingSubscriptions } from '@/lib/schema';
import {
  DEFAULT_PLAN_KEY,
  resolvePlanInterval,
  resolvePlanKey,
  type PlanInterval,
  type PlanKey,
} from '@/lib/plans';

export type PlanSubscriptionInput = {
  userId: string;
  planKey?: string | null;
  planInterval?: string | null;
};

export type PlanSubscriptionResult = {
  planKey: PlanKey;
  planInterval: PlanInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

function getNextPeriodEnd(start: Date, interval: PlanInterval): Date {
  const end = new Date(start);
  if (interval === 'yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function createPlanSubscription(
  input: PlanSubscriptionInput
): Promise<PlanSubscriptionResult | null> {
  const resolvedPlanKey = resolvePlanKey(input.planKey);
  if (resolvedPlanKey === DEFAULT_PLAN_KEY) return null;

  const resolvedInterval = resolvePlanInterval(input.planInterval);
  const currentPeriodStart = new Date();
  const currentPeriodEnd = getNextPeriodEnd(currentPeriodStart, resolvedInterval);

  await db.insert(billingSubscriptions).values({
    userId: input.userId,
    planKey: resolvedPlanKey,
    status: 'active',
    currentPeriodStart,
    currentPeriodEnd,
  });

  return {
    planKey: resolvedPlanKey,
    planInterval: resolvedInterval,
    currentPeriodStart,
    currentPeriodEnd,
  };
}
