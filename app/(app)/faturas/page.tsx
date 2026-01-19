'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getAccounts } from '@/lib/actions/accounts';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { FaturaList } from '@/components/fatura-list';
import { useMonthStore } from '@/lib/stores/month-store';
import { useFaturasData } from '@/lib/hooks/use-faturas-data';
import { usePrefetchMonths } from '@/lib/hooks/use-prefetch-months';
import type { Account } from '@/lib/schema';

export default function FaturasPage() {
  const t = useTranslations('faturas');
  const yearMonth = useMonthStore((state) => state.currentMonth);
  const { data: faturas, loading } = useFaturasData(yearMonth);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Prefetch adjacent months
  usePrefetchMonths('faturas');

  // Set initial month to next month if not set
  useEffect(() => {
    const setMonth = useMonthStore.getState().setMonth;
    const currentMonth = useMonthStore.getState().currentMonth;
    // Only set to next month on first load if current month equals this month
    if (currentMonth === getCurrentYearMonth()) {
      setMonth(getCurrentYearMonth(true));
    }
  }, []);

  // Fetch accounts on mount
  useEffect(() => {
    getAccounts().then((accts) => {
      setAccounts(accts);
      setLoadingAccounts(false);
    });
  }, []);

  const checkingAccounts = accounts.filter(a => a.type !== 'credit_card');

  if (loading || loadingAccounts || !faturas) {
    return (
      <div>
        <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <MonthPicker pageType="faturas" />
        </div>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="text-lg">{t('loading', { default: 'Carregando...' })}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker pageType="faturas" />
      </div>

      <FaturaList
        faturas={faturas}
        checkingAccounts={checkingAccounts}
      />
    </div>
  );
}
