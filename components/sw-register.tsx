'use client';

import { useEffect } from 'react';

/**
 * Client component that registers the service worker
 * Must be imported in root layout to ensure SW is available for PWA features
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      // Check if already registered first to avoid duplicate registration
      navigator.serviceWorker.getRegistration('/').then((existing) => {
        if (existing) {
          console.log('[SW] Already registered:', existing.scope);
          return;
        }

        // Only register if not already present
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[SW] Registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.error('[SW] Registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
