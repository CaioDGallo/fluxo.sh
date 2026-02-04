import { NextResponse } from 'next/server';
import { processPendingNotificationJobs } from '@/lib/actions/notification-jobs';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';
import { sendAllDailyDigests } from '@/lib/actions/daily-digest';
import { scheduleBillReminderNotifications } from '@/lib/actions/bill-reminder-jobs';
import { sendAllDailyPushes } from '@/lib/actions/daily-push';
import { sendRenewalReminders } from '@/lib/actions/renewal-reminders';
import { runPluggyCronSync } from '@/lib/actions/pluggy-cron';
import { updateOccurrenceStatuses, generateFutureOccurrences } from '@/lib/actions/bill-cron';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('[cron:daily] Invoked');

  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[cron:daily] Auth failed - check CRON_SECRET env var');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[cron:daily] Auth passed, running jobs...');

  const url = new URL(request.url);
  const jobOverride = url.searchParams.get('job');

  // Determine which jobs to run
  const runNotifications = !jobOverride || jobOverride === 'notifications' || jobOverride === 'all';
  const runBillReminders = !jobOverride || jobOverride === 'bill-reminders' || jobOverride === 'all';
  const runBalanceReconciliation = !jobOverride || jobOverride === 'balance-reconciliation' || jobOverride === 'all';
  const runDailyDigest = !jobOverride || jobOverride === 'daily-digest' || jobOverride === 'all';
  const runDailyPush = !jobOverride || jobOverride === 'daily-push' || jobOverride === 'all';
  const runRenewalReminders = !jobOverride || jobOverride === 'renewal-reminders' || jobOverride === 'all';
  const runPluggySync = !jobOverride || jobOverride === 'pluggy-sync' || jobOverride === 'all';
  const runBillOccurrences = !jobOverride || jobOverride === 'bill-occurrences' || jobOverride === 'all';

  try {
    const billReminderResult = runBillReminders ? await scheduleBillReminderNotifications() : null;
    const notificationResult = runNotifications ? await processPendingNotificationJobs() : null;

    const results = await Promise.allSettled([
      runBalanceReconciliation ? reconcileAllAccountBalances() : Promise.resolve(null),
      runDailyDigest ? sendAllDailyDigests() : Promise.resolve(null),
      runDailyPush ? sendAllDailyPushes() : Promise.resolve(null),
      runRenewalReminders ? sendRenewalReminders() : Promise.resolve(null),
      runPluggySync ? runPluggyCronSync() : Promise.resolve(null),
      runBillOccurrences ? (async () => {
        const statuses = await updateOccurrenceStatuses();
        const generated = await generateFutureOccurrences();
        return { ...statuses, ...generated };
      })() : Promise.resolve(null),
    ]);

    // Extract values and log failures
    const balanceResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const dailyDigestResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const dailyPushResult = results[2].status === 'fulfilled' ? results[2].value : null;
    const renewalRemindersResult = results[3].status === 'fulfilled' ? results[3].value : null;
    const pluggySyncResult = results[4].status === 'fulfilled' ? results[4].value : null;

    // Log any failures
    const billOccurrencesResult = results[5].status === 'fulfilled' ? results[5].value : null;

    const jobNames = ['balance-reconciliation', 'daily-digest', 'daily-push', 'renewal-reminders', 'pluggy-sync', 'bill-occurrences'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[cron:daily] ${jobNames[index]} failed:`, result.reason);
      }
    });

    console.log('[cron:daily] All jobs completed');

    return NextResponse.json({
      success: true,
      notifications: notificationResult,
      billReminders: billReminderResult,
      balanceReconciliation: balanceResult,
      dailyDigest: dailyDigestResult,
      dailyPush: dailyPushResult,
      renewalReminders: renewalRemindersResult,
      pluggySync: pluggySyncResult,
      billOccurrences: billOccurrencesResult,
    });
  } catch (error) {
    console.error('[cron:daily] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
