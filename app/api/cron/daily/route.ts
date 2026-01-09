import { NextResponse } from 'next/server';
import { processPendingNotificationJobs } from '@/lib/actions/notification-jobs';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';
import { updatePastItemStatuses } from '@/lib/actions/status-updates';

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

  try {
    const [notificationResult, balanceResult, statusResult] = await Promise.all([
      runNotifications ? processPendingNotificationJobs() : Promise.resolve(null),
      runBalanceReconciliation ? reconcileAllAccountBalances() : Promise.resolve(null),
      runStatusUpdates ? updatePastItemStatuses() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      notifications: notificationResult,
      balanceReconciliation: balanceResult,
      statusUpdates: statusResult,
    });
  } catch (error) {
    console.error('[cron:daily] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
