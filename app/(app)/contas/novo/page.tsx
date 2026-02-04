import { getTranslations } from 'next-intl/server';
import { getCategories } from '@/lib/actions/categories';
import { getAccounts } from '@/lib/actions/accounts';
import { BillFormClient } from '@/components/bill-form-client';

export default async function NewBillPage() {
  const t = await getTranslations('contas');
  const [categories, accounts] = await Promise.all([
    getCategories('expense'),
    getAccounts(),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('addBill')}</h1>
      </div>
      <BillFormClient categories={categories} accounts={accounts} billId={null} />
    </div>
  );
}
