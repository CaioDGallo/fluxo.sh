'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { initializePluggyItemAccounts } from '@/lib/actions/pluggy';
import { syncPluggyItemById } from '@/lib/actions/pluggy';

export function PluggyCallbackClient() {
  const t = useTranslations('openFinance.oauthCallback');
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('itemId');

  const [isPWA] = useState(() => {
    // Detect PWA mode once during initialization
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches;
  });
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    // Check itemId during initialization to avoid setState in effect
    return itemId ? 'loading' : 'error';
  });

  useEffect(() => {
    if (!itemId) return;

    // Initialize accounts and sync
    (async () => {
      try {
        // First initialize accounts from the item
        await initializePluggyItemAccounts(itemId);

        // Then trigger a sync to get latest data
        await syncPluggyItemById(itemId);

        setStatus('success');

        // If in PWA, redirect to accounts page
        if (isPWA) {
          setTimeout(() => {
            router.push('/settings/accounts');
          }, 1000);
        }
      } catch (error) {
        console.error('[pluggy-callback] Failed:', error);
        setStatus('error');
      }
    })();
  }, [itemId, router, isPWA]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-4 text-2xl">{t('loading')}</div>
          <div className="text-muted-foreground">{t('loadingDescription')}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-4 text-2xl">{t('error')}</div>
          <div className="text-muted-foreground">{t('errorDescription')}</div>
        </div>
      </div>
    );
  }

  // Success state
  if (isPWA) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-4 text-2xl">{t('successPWA')}</div>
          <div className="text-muted-foreground">{t('redirecting')}</div>
        </div>
      </div>
    );
  }

  // Browser mode - show instruction to return to app
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="mb-4 text-2xl">{t('successBrowser')}</div>
        <div className="text-muted-foreground">{t('returnToApp')}</div>
      </div>
    </div>
  );
}
