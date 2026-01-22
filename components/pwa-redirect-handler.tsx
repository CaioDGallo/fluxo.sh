'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Handles PWA deep linking on iOS.
 *
 * iOS ignores paths in webapp:// URLs and always loads the start_url.
 * This component checks for a ?redirect= query parameter and navigates
 * to the specified path client-side.
 *
 * Usage in iOS Shortcuts:
 * webapp://yourdomain.com/?redirect=/quick/add-expense
 */
export function PWARedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectPath = searchParams.get('redirect');

    if (redirectPath) {
      // Remove the redirect param and navigate to target path
      router.replace(redirectPath);
    }
  }, [searchParams, router]);

  return null;
}
