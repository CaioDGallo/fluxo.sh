'use client';

import { useState, useEffect, useTransition } from 'react';
import { updateUserSettings } from '@/lib/actions/user-settings';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslations, useLocale } from 'next-intl';
import { setLocale } from '@/lib/i18n/actions';
import type { UserSettings } from '@/lib/schema';
import type { Locale } from '@/lib/i18n/config';
import { PushNotificationSection } from '@/components/push-notification-section';

type Theme = 'light' | 'dark' | 'system';

const TIMEZONES = [
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

type PreferencesFormProps = {
  settings: UserSettings;
};

export function PreferencesForm({ settings }: PreferencesFormProps) {
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });

  // Language state
  const locale = useLocale() as Locale;
  const [isPendingLocale, startTransition] = useTransition();

  const t = useTranslations('preferences');
  const tTheme = useTranslations('theme');
  const tLanguage = useTranslations('language');

  // Apply theme changes
  useEffect(() => {
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

  const handleLanguageChange = (newLocale: string) => {
    startTransition(async () => {
      await setLocale(newLocale as Locale);
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateUserSettings({
        timezone,
        notificationEmail: notificationEmail || null,
        notificationsEnabled,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[PreferencesForm] Submit failed:', err);
      setError(t('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {/* Appearance Section */}
        <Field>
          <FieldLabel htmlFor="theme">{tTheme('label')}</FieldLabel>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="system">{tTheme('system')}</SelectItem>
                <SelectItem value="light">{tTheme('light')}</SelectItem>
                <SelectItem value="dark">{tTheme('dark')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="language">{tLanguage('label')}</FieldLabel>
          <Select value={locale} onValueChange={handleLanguageChange} disabled={isPendingLocale}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="pt-BR">{tLanguage('portuguese')}</SelectItem>
                <SelectItem value="en">{tLanguage('english')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="timezone">{t('timezone')}</FieldLabel>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="notificationEmail">{t('notificationEmail')}</FieldLabel>
          <Input
            type="email"
            id="notificationEmail"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder={t('notificationEmailPlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="notificationsEnabled">{t('notificationsEnabled')}</FieldLabel>
          <Select value={notificationsEnabled.toString()} onValueChange={(v) => setNotificationsEnabled(v === 'true')}>
            <SelectTrigger id="notificationsEnabled">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="true">{t('yes')}</SelectItem>
                <SelectItem value="false">{t('no')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {t('digestScheduleNote')}
          </p>
        </Field>

        {/* Push Notifications Section */}
        <PushNotificationSection />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            {t('savedSuccessfully')}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </FieldGroup>
    </form>
  );
}