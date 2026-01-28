'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { createBillingPortalSession } from '@/lib/actions/billing';
import { useState } from 'react';
import type { PlanLimits } from '@/lib/plans';

type SubscriptionInfo = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
} | null;

type PlanSettingsClientProps = {
  planName: string;
  planLimits: PlanLimits;
  isFreePlan: boolean;
  isFounder: boolean;
  hasBillingAccount: boolean;
  subscription: SubscriptionInfo;
};

export function PlanSettingsClient({
  planName,
  planLimits,
  isFreePlan,
  isFounder,
  hasBillingAccount,
  subscription,
}: PlanSettingsClientProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      await createBillingPortalSession();
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatLimit = (limit: number) => {
    if (limit === Infinity) return t('planLimitUnlimited');
    return limit.toString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('planCurrent')}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isFreePlan ? 'outline' : 'default'}>{planName}</Badge>
              {isFounder && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {t('planFounderBadge')}
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {isFreePlan ? t('planCurrentFreeDescription') : t('planCurrentPaidDescription')}
            {isFounder && (
              <>
                <br />
                {t('planFounderBenefits')}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('planLimitCategories')}</span>
              <span className="font-medium">{formatLimit(planLimits.maxCategories)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('planLimitAccounts')}</span>
              <span className="font-medium">{formatLimit(planLimits.maxAccounts)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('planLimitCreditCards')}</span>
              <span className="font-medium">{formatLimit(planLimits.maxCreditCards)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('planLimitImports')}</span>
              <span className="font-medium">{formatLimit(planLimits.importWeekly)}/semana</span>
            </div>
          </div>

          {subscription && (
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('planStatus')}</span>
                <span className="font-medium capitalize">{subscription.status}</span>
              </div>
              {subscription.currentPeriodEnd && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('planRenewsOn')}</span>
                  <span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  {t('planCanceling')}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {isFreePlan ? (
              <Button asChild className="w-full">
                <Link href="/#planos">{t('planUpgrade')}</Link>
              </Button>
            ) : hasBillingAccount ? (
              <Button onClick={handleManageBilling} disabled={loading} className="w-full">
                {loading ? tCommon('loading') : t('planManageBilling')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
