'use client';

import { useState, useEffect, useRef } from 'react';
import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';
import { usePushNotifications } from '@/lib/hooks/use-push-notifications';
import { markPushNotificationPrompted } from '@/lib/actions/push-notifications';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun03Icon, Moon02Icon, SunCloudLittleRain01Icon, Notification03Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

export function PreferencesStep() {
  const t = useTranslations('onboarding.preferences');
  const { nextStep } = useOnboarding();
  const { state, requestPermission } = usePushNotifications();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const [isEnabling, setIsEnabling] = useState(false);
  const [isGranted, setIsGranted] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!mounted.current) return;

    const root = document.documentElement;
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    try {
      const result = await requestPermission();
      if (result.success) {
        setIsGranted(true);
      }
    } finally {
      setIsEnabling(false);
    }
  };

  const handleContinue = async () => {
    // Mark as prompted to prevent dashboard auto-prompt
    await markPushNotificationPrompted();
    nextStep();
  };

  const showNotifications = state === 'prompt' || state === 'granted';

  return (
    <WizardStep className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('theme.label')}</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
              theme === 'light'
                ? 'border-foreground bg-muted'
                : 'border-border hover:border-muted-foreground'
            )}
          >
            <HugeiconsIcon icon={Sun03Icon} className="size-6" />
            <span className="text-sm font-medium">{t('theme.light')}</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
              theme === 'dark'
                ? 'border-foreground bg-muted'
                : 'border-border hover:border-muted-foreground'
            )}
          >
            <HugeiconsIcon icon={Moon02Icon} className="size-6" />
            <span className="text-sm font-medium">{t('theme.dark')}</span>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
              theme === 'system'
                ? 'border-foreground bg-muted'
                : 'border-border hover:border-muted-foreground'
            )}
          >
            <HugeiconsIcon icon={SunCloudLittleRain01Icon} className="size-6" />
            <span className="text-sm font-medium">{t('theme.system')}</span>
          </button>
        </div>
      </div>

      {/* Push Notifications */}
      {showNotifications && (
        <div className="space-y-3">
          <label className="text-sm font-medium">{t('notifications.label')}</label>
          <div
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg border-2',
              isGranted
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-border'
            )}
          >
            <HugeiconsIcon
              icon={isGranted ? Notification03Icon : Notification03Icon}
              className={cn('size-5', isGranted && 'text-green-600 dark:text-green-400')}
            />
            <div className="flex-1">
              <p className="text-sm">{t('notifications.description')}</p>
            </div>
            {!isGranted && (
              <Button
                onClick={handleEnableNotifications}
                disabled={isEnabling}
                size="sm"
                variant="outline"
              >
                {isEnabling ? (
                  <span className="inline-flex items-center gap-2">
                    <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                    {t('notifications.enabling')}
                  </span>
                ) : (
                  t('notifications.enable')
                )}
              </Button>
            )}
            {isGranted && (
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {t('notifications.enabled')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={handleContinue} className="flex-1">
          {t('skip')}
        </Button>
        <Button onClick={handleContinue} className="flex-1">
          {t('continue')}
        </Button>
      </div>
    </WizardStep>
  );
}
