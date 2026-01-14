import { getPendingBillReminders } from '@/lib/actions/bill-reminders';
import { getUserSettings } from '@/lib/actions/user-settings';
import { BillReminderBannerClient } from '@/components/bill-reminder-banner-client';

export async function BillReminderBanner() {
  const [reminders, settings] = await Promise.all([
    getPendingBillReminders(),
    getUserSettings(),
  ]);

  if (reminders.length === 0) return null;

  const timeZone = settings?.timezone || 'UTC';

  const reminderData = reminders.map((reminder) => ({
    id: reminder.id,
    name: reminder.name,
    amount: reminder.amount,
    nextDue: reminder.nextDue.toISOString(),
  }));

  return <BillReminderBannerClient reminders={reminderData} timeZone={timeZone} />;
}
