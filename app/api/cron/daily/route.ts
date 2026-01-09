import { NextResponse } from 'next/server';
import { processPendingNotificationJobs } from '@/lib/actions/notification-jobs';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';
import { updatePastItemStatuses } from '@/lib/actions/status-updates';
import { syncAllUsersCalendars } from '@/lib/actions/calendar-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobOverride = url.searchParams.get('job');

  // Determine which jobs to run
  const runNotifications = !jobOverride || jobOverride === 'notifications' || jobOverride === 'all';
  const runBalanceReconciliation = !jobOverride || jobOverride === 'balance-reconciliation' || jobOverride === 'all';
  const runStatusUpdates = !jobOverride || jobOverride === 'status-updates' || jobOverride === 'all';
  const runCalendarSync = !jobOverride || jobOverride === 'calendar-sync' || jobOverride === 'all';

  try {
    const [notificationResult, balanceResult, statusResult, calendarSyncResult] = await Promise.all([
      runNotifications ? processPendingNotificationJobs() : Promise.resolve(null),
      runBalanceReconciliation ? reconcileAllAccountBalances() : Promise.resolve(null),
      runStatusUpdates ? updatePastItemStatuses() : Promise.resolve(null),
      runCalendarSync ? syncAllUsersCalendars() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      notifications: notificationResult,
      balanceReconciliation: balanceResult,
      statusUpdates: statusResult,
      calendarSync: calendarSyncResult,
    });
  } catch (error) {
    console.error('[cron:daily] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
