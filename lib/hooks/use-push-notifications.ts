'use client';

import { useEffect, useState, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig, VAPID_KEY } from '@/lib/firebase/config';
import { registerFcmToken, unregisterFcmToken } from '@/lib/actions/push-notifications';

type PushState = 'loading' | 'unsupported' | 'prompt' | 'denied' | 'granted' | 'error';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const initializeMessaging = useCallback(async () => {
    try {
      // Initialize Firebase app
      let app: FirebaseApp;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      // Get messaging instance
      const messagingInstance = getMessaging(app);

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // Get FCM token
      const token = await getToken(messagingInstance, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        setCurrentToken(token);

        // Get device name
        const deviceName = getDeviceName();

        // Register token with backend
        await registerFcmToken(token, deviceName);

        // Listen for foreground messages
        onMessage(messagingInstance, (payload) => {
          console.log('Foreground message received:', payload);

          // Show notification manually in foreground
          if (payload.notification) {
            new Notification(payload.notification.title || 'fluxo.sh', {
              body: payload.notification.body,
              icon: '/brand-kit/exports/icon-192-dark.png',
              tag: payload.data?.tag || 'default',
            });
          }
        });
      }
    } catch (error) {
      console.error('Error initializing messaging:', error);
      setState('error');
    }
  }, []);

  useEffect(() => {
    // Compute the state based on browser capabilities and permissions
    let newState: PushState;
    let shouldInitialize = false;

    // Check if push notifications are supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      newState = 'unsupported';
    } else if (!('serviceWorker' in navigator)) {
      newState = 'unsupported';
    } else {
      // Check current permission state
      const permission = Notification.permission;
      if (permission === 'denied') {
        newState = 'denied';
      } else if (permission === 'granted') {
        newState = 'granted';
        shouldInitialize = true;
      } else {
        newState = 'prompt';
      }
    }

    // Update state once (initialization pattern - checking browser capabilities on mount)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(newState);

    // Initialize messaging if needed
    if (shouldInitialize) {
      void initializeMessaging();
    }
  }, [initializeMessaging]);

  const requestPermission = async () => {
    if (state === 'unsupported' || state === 'denied') {
      return { success: false, error: 'Permission denied or unsupported' };
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setState('granted');
        await initializeMessaging();
        return { success: true };
      } else {
        setState('denied');
        return { success: false, error: 'Permission denied' };
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setState('error');
      return { success: false, error: 'Failed to request permission' };
    }
  };

  const disable = async () => {
    if (!currentToken) {
      return { success: false, error: 'No token to unregister' };
    }

    try {
      await unregisterFcmToken(currentToken);
      setCurrentToken(null);
      setState('prompt');
      return { success: true };
    } catch (error) {
      console.error('Error disabling push notifications:', error);
      return { success: false, error: 'Failed to disable notifications' };
    }
  };

  return {
    state,
    requestPermission,
    disable,
  };
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Detect OS
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
