import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type BalanceSummaryProps = {
  income: number; // cents
  expenses: number; // cents
  netBalance: number; // cents
};

export function BalanceSummary({ income, expenses, netBalance }: BalanceSummaryProps) {
  const isPositive = netBalance >= 0;

  return (
    <Card data-slot="balance-summary">
      <CardHeader>
        <CardTitle>Balance Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-gray-500">Total Income</div>
          <div className="text-3xl font-bold text-green-600">
            +{formatCurrency(income)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Total Expenses</div>
          <div className="text-2xl font-semibold text-red-600">
            -{formatCurrency(expenses)}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-xs text-gray-500">Net Balance</div>
          <div
            className={`text-2xl font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'
              }`}
          >
            {isPositive ? '+' : ''}{formatCurrency(netBalance)}
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${isPositive ? 'bg-green-600' : 'bg-red-600'
              }`}
            style={{
              width: income > 0 ? `${Math.min((expenses / income) * 100, 100)}%` : '0%'
            }}
          />
        </div>
        <div className="text-center text-xs text-gray-500">
          {income > 0
            ? `${((expenses / income) * 100).toFixed(1)}% of income spent`
            : 'No income recorded'}
        </div>
      </CardContent>
    </Card>
  );
}
