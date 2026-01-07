import { getTranslations } from 'next-intl/server';
import { getOrCreateUserSettings } from '@/lib/actions/user-settings';
import { PreferencesForm } from './preferences-form';

export default async function PreferencesPage() {
  const t = await getTranslations('preferences');
  const settings = await getOrCreateUserSettings();

  if (!settings) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
        <p className="text-red-600">Failed to load settings. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <PreferencesForm settings={settings} />
    </div>
  );
}