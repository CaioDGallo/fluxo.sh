import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { billingCustomers, billingSubscriptions } from '@/lib/schema';
import { users } from '@/lib/auth-schema';
import { getUserPlan } from '@/lib/plan-entitlements';
import { PLANS } from '@/lib/plans';
import { and, eq, inArray } from 'drizzle-orm';
import { PlanSettingsClient } from './plan-settings-client';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

export default async function PlanSettingsPage() {
  const t = await getTranslations('settings');
  const session = await getSession();

  if (!session?.user?.id) {
    return <div>{t('notAuthenticated')}</div>;
  }

  const userId = session.user.id;
  const planKey = await getUserPlan(userId);
  const plan = PLANS[planKey];

  // Get active subscription details
  const [subscription] = await db
    .select()
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.userId, userId),
        inArray(billingSubscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES)
      )
    )
    .limit(1);

  // Get billing customer
  const customer = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, userId),
  });

  // Get founder status
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isFounder: true },
  });

  const hasBillingAccount = !!customer;
  const isFreePlan = planKey === 'free';
  const isFounder = user?.isFounder ?? false;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('planTitle')}</h1>
      <PlanSettingsClient
        planName={plan.name}
        planLimits={plan.limits}
        isFreePlan={isFreePlan}
        isFounder={isFounder}
        hasBillingAccount={hasBillingAccount}
        subscription={
          subscription
            ? {
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              }
            : null
        }
      />
    </div>
  );
}
