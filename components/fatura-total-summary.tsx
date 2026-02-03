'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type FaturaTotalSummaryProps = {
  totalAmount: number;      // Total across all faturas (cents)
  paidAmount: number;       // Sum of paid faturas (cents)
  paidCount: number;        // Count of paid faturas
  pendingAmount: number;    // Sum of pending faturas (cents)
  pendingCount: number;
  overdueAmount: number;    // Sum of overdue faturas (cents)
  overdueCount: number;
};

export function FaturaTotalSummary({
  totalAmount,
  paidAmount,
  paidCount,
  pendingAmount,
  pendingCount,
  overdueAmount,
  overdueCount,
}: FaturaTotalSummaryProps) {
  const t = useTranslations('faturas');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('totalFaturas')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total row - larger, primary */}
        <div className="flex justify-between text-lg">
          <span className="text-gray-500">{t('totalAmount')}</span>
          <span className="font-bold">{formatCurrency(totalAmount)}</span>
        </div>

        <div className='shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border border-black p-2'>
          {/* Status breakdown rows */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('paidFaturas')} ({paidCount})</span>
            <span className="font-semibold text-green-600">{formatCurrency(paidAmount)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('pendingFaturas')} ({pendingCount})</span>
            <span className="font-semibold text-gray-500">{formatCurrency(pendingAmount)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('overdueFaturas')} ({overdueCount})</span>
            <span className="font-semibold text-red-600">{formatCurrency(overdueAmount)}</span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
