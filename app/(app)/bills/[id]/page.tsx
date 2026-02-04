import { getTranslations } from 'next-intl/server';
import { getBill } from '@/lib/actions/bills';
import { getCategories } from '@/lib/actions/categories';
import { getAccounts } from '@/lib/actions/accounts';
import { BillDetailClient } from '@/components/bill-detail-client';

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('bills');

  const [billData, categories, accounts] = await Promise.all([
    getBill(Number(id)),
    getCategories('expense'),
    getAccounts(),
  ]);

  if (!billData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="text-gray-500">{t('noOccurrences')}</p>
      </div>
    );
  }

  return (
    <BillDetailClient billData={billData} categories={categories} accounts={accounts} />
  );
}
