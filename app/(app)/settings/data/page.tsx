import { getTranslations } from 'next-intl/server';
import { ResetTransactionsSection } from './reset-transactions-section';
import { DeleteAccountSection } from './delete-account-section';

export default async function DataSettingsPage() {
  const t = await getTranslations('dataSettings');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <ResetTransactionsSection />
      <DeleteAccountSection />
    </div>
  );
}
