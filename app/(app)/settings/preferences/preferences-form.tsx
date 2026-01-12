'use client';

import { useState } from 'react';
import { updateUserSettings } from '@/lib/actions/user-settings';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import type { UserSettings } from '@/lib/schema';

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
  const t = useTranslations('preferences');

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