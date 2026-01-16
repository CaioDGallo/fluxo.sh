import { getTranslations } from 'next-intl/server';
import { ResetTransactionsSection } from './reset-transactions-section';

export default async function DataSettingsPage() {
  const t = await getTranslations('dataSettings');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <ResetTransactionsSection />
    </div>
  );
}
