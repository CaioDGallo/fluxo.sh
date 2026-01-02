'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { addMonths } from '@/lib/utils';
import type { Account, Category } from '@/lib/schema';

type ExpenseFiltersProps = {
  accounts: Account[];
  categories: Category[];
  currentMonth: string;
};

export function ExpenseFilters({
  accounts,
  categories,
  currentMonth,
}: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('filters');
  const tExpenses = useTranslations('expenses');

  function navigateMonth(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    const params = new URLSearchParams(searchParams);
    params.set('month', newMonth);
    router.push(`/expenses?${params.toString()}`);
  }

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/expenses?${params.toString()}`);
  }

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
    locale,
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="mb-6 space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigateMonth(-1)} variant="hollow" size="icon">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <span className="min-w-48 text-center text-lg font-medium capitalize">
            {monthName}
          </span>
          <Button onClick={() => navigateMonth(1)} variant="hollow" size="icon">
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Filter selects */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={searchParams.get('category') || 'all'}
          onValueChange={(value) => updateFilter('category', value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('account') || 'all'}
          onValueChange={(value) => updateFilter('account', value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('allAccounts')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allAccounts')}</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id.toString()}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('status') || 'all'}
          onValueChange={(value) => updateFilter('status', value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="pending">{tExpenses('pending')}</SelectItem>
            <SelectItem value="paid">{tExpenses('paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
