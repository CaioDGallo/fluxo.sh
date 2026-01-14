'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { acknowledgeBillReminder } from '@/lib/actions/bill-reminders';
import { formatCurrencyWithLocale } from '@/lib/utils';

type ReminderItem = {
  id: number;
  name: string;
  amount: number | null;
  nextDue: string;
};

type BillReminderBannerClientProps = {
  reminders: ReminderItem[];
  timeZone: string;
};

export function BillReminderBannerClient({ reminders, timeZone }: BillReminderBannerClientProps) {
  const [items, setItems] = useState(reminders);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const locale = useLocale();
  const t = useTranslations('billReminders');
  const tCommon = useTranslations('common');

  if (items.length === 0) return null;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });

  async function handleAcknowledge(id: number) {
    setSubmittingId(id);

    try {
      const result = await acknowledgeBillReminder(id);

      if (!result.success) {
        toast.error(result.error || tCommon('unexpectedError'));
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('[BillReminderBanner] Acknowledge failed:', error);
      toast.error(tCommon('unexpectedError'));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <p className="text-sm font-medium">{t('bannerTitle')}</p>
      <p className="text-xs text-amber-800">{t('bannerDescription', { count: items.length })}</p>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{item.name}</span>
              {item.amount != null && (
                <span className="text-amber-800">
                  {' '}
                  • {formatCurrencyWithLocale(item.amount, locale)}
                </span>
              )}
              <span className="text-amber-800">
                {' '}
                • {dateFormatter.format(new Date(item.nextDue))}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-amber-300 px-2 text-amber-900"
              onClick={() => handleAcknowledge(item.id)}
              disabled={submittingId === item.id}
            >
              {submittingId === item.id ? tCommon('saving') : t('acknowledge')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
