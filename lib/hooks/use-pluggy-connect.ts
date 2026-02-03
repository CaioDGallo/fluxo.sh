'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const PLUGGY_SDK_URL = 'https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js';
const INCLUDE_SANDBOX = true;

type UsePluggyConnectOptions = {
  onSuccess: (itemId: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
};

declare global {
  interface Window {
    PluggyConnect?: {
      new (options: {
        connectToken: string;
        onSuccess: (data: { itemId?: string; item?: { id?: string } }) => void;
        onError: (error: Error) => void;
        onClose: () => void;
        includeSandbox?: boolean;
      }): {
        init: () => Promise<void>;
        show: () => Promise<void>;
        destroy?: () => void;
      };
    };
  }
}

export function usePluggyConnect({ onSuccess, onError, onClose }: UsePluggyConnectOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const callbacksRef = useRef({ onSuccess, onError, onClose });

  // Keep callbacks current without re-triggering effects
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError, onClose };
  }, [onSuccess, onError, onClose]);

  // Load Pluggy SDK script once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.PluggyConnect) {
      setSdkReady(true);
      return;
    }
    if (scriptRef.current) return; // Already loading

    const script = document.createElement('script');
    script.src = PLUGGY_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.PluggyConnect) {
        setSdkReady(true);
      } else {
        callbacksRef.current.onError(new Error('Failed to load Pluggy SDK'));
      }
    };
    script.onerror = () => {
      callbacksRef.current.onError(new Error('Failed to load Pluggy SDK'));
    };
    scriptRef.current = script;
    document.head.appendChild(script);
  }, []);

  const open = useCallback(async (connectToken: string) => {
    if (!sdkReady || !window.PluggyConnect) {
      callbacksRef.current.onError(new Error('Pluggy SDK not loaded'));
      return;
    }

    setIsLoading(true);
    try {
      const connect = new window.PluggyConnect({
        connectToken,
        includeSandbox: INCLUDE_SANDBOX,
        onSuccess: (data) => {
          const itemId = data.itemId ?? data.item?.id;
          if (!itemId) {
            callbacksRef.current.onError(new Error('Pluggy itemId missing in success callback'));
            return;
          }
          callbacksRef.current.onSuccess(itemId);
        },
        onError: (error) => {
          callbacksRef.current.onError(error);
        },
        onClose: () => {
          callbacksRef.current.onClose();
        },
      });
      try {
        await connect.init();
      } catch (error) {
        if (error instanceof Error) {
          callbacksRef.current.onError(error);
        } else {
          callbacksRef.current.onError(new Error('Failed to open Pluggy Connect'));
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [sdkReady]);

  return { open, isLoading, sdkReady };
}
