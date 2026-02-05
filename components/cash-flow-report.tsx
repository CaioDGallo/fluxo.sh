import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

type CashFlowReportProps = {
  income: number;
  expenses: number;
  net: number;
};

export async function CashFlowReport({ income, expenses, net }: CashFlowReportProps) {
  const t = await getTranslations('cashFlow');
  const netPositive = net >= 0;

  return (
    <Card data-slot="cash-flow-report">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('income')}</span>
          <span className="font-semibold text-green-600">+{formatCurrency(income)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('expenses')}</span>
          <span className="font-semibold text-red-600">-{formatCurrency(expenses)}</span>
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('net')}</span>
          <span className={`font-semibold ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
            {netPositive ? '+' : ''}{formatCurrency(net)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
