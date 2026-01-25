import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    registration: ServiceWorkerRegistration;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clients: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    location: any;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

// FCM Push notification handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('push', (event: any) => {
  if (!event.data) return;
  const payload = event.data.json();

  // Extract title/body from multiple possible locations
  // 1. Root level (app format via push-sender.ts)
  // 2. notification object (Firebase Console format)
  // 3. nested data object (alternative format)
  const title = payload.title
    || payload.notification?.title
    || payload.data?.title
    || 'fluxo.sh';

  const body = payload.body
    || payload.notification?.body
    || payload.data?.body;

  const tag = payload.tag
    || payload.data?.tag
    || 'default';

  const url = payload.url
    || payload.data?.url
    || '/dashboard';

  const type = payload.type
    || payload.data?.type;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/brand-kit/exports/icon-192-dark.png',
      badge: '/brand-kit/exports/icon-192-dark.png',
      tag,
      data: { url, type },
    })
  );
});

// Notification click handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self.clients.matchAll({ type: 'window' }).then((clientList: any[]) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
