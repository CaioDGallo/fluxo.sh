import { NextResponse } from 'next/server';
import { processPendingNotificationJobs } from '@/lib/actions/notification-jobs';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const url = new URL(request.url);
  const jobOverride = url.searchParams.get('job');
  const hourUtc = new Date().getUTCHours();
  const runNotifications =
    jobOverride === 'notifications' ||
    jobOverride === 'both' ||
    (jobOverride === null && hourUtc === 11);
  const runBalanceReconciliation =
    jobOverride === 'balance-reconciliation' ||
    jobOverride === 'both' ||
    (jobOverride === null && hourUtc === 4);

  if (!runNotifications && !runBalanceReconciliation) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'Outside scheduled hours',
      hourUtc,
    });
  }

  try {
    const [notificationResult, balanceResult] = await Promise.all([
      runNotifications ? processPendingNotificationJobs() : Promise.resolve(null),
      runBalanceReconciliation ? reconcileAllAccountBalances() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      notifications: notificationResult,
      balanceReconciliation: balanceResult,
    });
  } catch (error) {
    console.error('[cron:notifications] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
