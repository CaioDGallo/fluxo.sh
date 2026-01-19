'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getBudgetsForMonth, getMonthlyBudget } from '@/lib/actions/budgets';
import { BudgetForm } from '@/components/budget-form';
import { MonthPicker } from '@/components/month-picker';
import { useMonthStore } from '@/lib/stores/month-store';

type BudgetForMonth = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  budgetId: number | null;
  budgetAmount: number | null;
};

export default function BudgetsPage() {
  const t = useTranslations('budgets');
  const yearMonth = useMonthStore((state) => state.currentMonth);
  const [budgets, setBudgets] = useState<BudgetForMonth[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      getBudgetsForMonth(yearMonth),
      getMonthlyBudget(yearMonth),
    ]).then(([fetchedBudgets, fetchedMonthlyBudget]) => {
      setBudgets(fetchedBudgets);
      setMonthlyBudget(fetchedMonthlyBudget);
      setLoading(false);
    });
  }, [yearMonth]);

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <MonthPicker />
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
        <MonthPicker />
      </div>

      <BudgetForm yearMonth={yearMonth} budgets={budgets} monthlyBudget={monthlyBudget} />
    </div>
  );
}
