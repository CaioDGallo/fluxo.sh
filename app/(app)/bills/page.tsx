import { getTranslations } from 'next-intl/server';
import { getBills } from '@/lib/actions/bills';
import { getCategories } from '@/lib/actions/categories';
import { getAccounts } from '@/lib/actions/accounts';
import { BillsClient } from '@/components/bills-client';

export default async function BillsPage() {
  const t = await getTranslations('bills');
  const [billRows, categories, accounts] = await Promise.all([
    getBills(),
    getCategories('expense'),
    getAccounts(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-balance">{t('title')}</h1>
      </div>
      <BillsClient
        bills={billRows}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
