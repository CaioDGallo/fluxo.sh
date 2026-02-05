import { getTranslations } from 'next-intl/server';
import { PluggyCallbackClient } from './pluggy-callback-client';

export async function generateMetadata() {
  const t = await getTranslations('openFinance.oauthCallback');
  return { title: t('title') };
}

export default function PluggyCallbackPage() {
  return <PluggyCallbackClient />;
}
