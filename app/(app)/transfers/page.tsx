import { getTranslations } from 'next-intl/server';
import { getTransfers } from '@/lib/actions/transfers';
import { TransferList } from '@/components/transfer-list';

export default async function TransfersPage() {
  const t = await getTranslations('transfers');
  const transfers = await getTransfers();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <TransferList transfers={transfers} />
    </div>
  );
}
