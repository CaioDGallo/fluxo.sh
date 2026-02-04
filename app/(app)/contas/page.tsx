import { getTranslations } from 'next-intl/server';
import { getBills } from '@/lib/actions/bills';
import { getCategories } from '@/lib/actions/categories';
import { getAccounts } from '@/lib/actions/accounts';
import { BillsClient } from '@/components/bills-client';

export default async function ContasPage() {
  const t = await getTranslations('contas');
  const [billRows, categories, accounts] = await Promise.all([
    getBills(),
    getCategories('expense'),
    getAccounts(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <BillsClient
        bills={billRows}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
