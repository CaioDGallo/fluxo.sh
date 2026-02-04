import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';

const processPendingNotificationJobs = vi.fn();
const scheduleBillReminderNotifications = vi.fn();
const reconcileAllAccountBalances = vi.fn();
const sendAllDailyDigests = vi.fn();
const sendRenewalReminders = vi.fn();
const sendAllDailyPushes = vi.fn();
const runPluggyCronSync = vi.fn();
const updateOccurrenceStatuses = vi.fn();
const generateFutureOccurrences = vi.fn();

vi.mock('@/lib/actions/notification-jobs', () => ({ processPendingNotificationJobs }));
vi.mock('@/lib/actions/bill-reminder-jobs', () => ({ scheduleBillReminderNotifications }));
vi.mock('@/lib/actions/accounts', () => ({ reconcileAllAccountBalances }));
vi.mock('@/lib/actions/daily-digest', () => ({ sendAllDailyDigests }));
vi.mock('@/lib/actions/renewal-reminders', () => ({ sendRenewalReminders }));
vi.mock('@/lib/actions/daily-push', () => ({ sendAllDailyPushes }));
vi.mock('@/lib/actions/pluggy-cron', () => ({ runPluggyCronSync }));
vi.mock('@/lib/actions/bill-cron', () => ({ updateOccurrenceStatuses, generateFutureOccurrences }));

let GET: typeof import('@/app/api/cron/daily/route').GET;

describe('GET /api/cron/daily', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ GET } = await import('@/app/api/cron/daily/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';

    processPendingNotificationJobs.mockResolvedValue({ processed: 1, failed: 0 });
    scheduleBillReminderNotifications.mockResolvedValue({ scheduled: 3, skipped: 1 });
    reconcileAllAccountBalances.mockResolvedValue({ updated: 2 });
    sendAllDailyDigests.mockResolvedValue({ success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] });
    sendRenewalReminders.mockResolvedValue({ success: true, sent: 1, skipped: 0, errors: 0 });
    sendAllDailyPushes.mockResolvedValue({ success: true, sent: 1 });
    runPluggyCronSync.mockResolvedValue({ success: true });
    updateOccurrenceStatuses.mockResolvedValue({ updated: 1, skipped: 0 });
    generateFutureOccurrences.mockResolvedValue({ created: 2, skipped: 0 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 when authorization header is invalid', async () => {
    const request = new Request('http://localhost/api/cron/daily', {
      headers: { authorization: 'Bearer wrong' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it.each([
    {
      job: 'notifications',
      called: {
        notifications: true,
        billReminders: false,
        balance: false,
        digest: false,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'bill-reminders',
      called: {
        notifications: false,
        billReminders: true,
        balance: false,
        digest: false,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'balance-reconciliation',
      called: {
        notifications: false,
        billReminders: false,
        balance: true,
        digest: false,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'daily-digest',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        digest: true,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'daily-push',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        digest: false,
        dailyPush: true,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'renewal-reminders',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        digest: false,
        dailyPush: false,
        renewalReminders: true,
        pluggySync: false,
        billOccurrences: false,
      },
    },
    {
      job: 'pluggy-sync',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        digest: false,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: true,
        billOccurrences: false,
      },
    },
    {
      job: 'bill-occurrences',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        digest: false,
        dailyPush: false,
        renewalReminders: false,
        pluggySync: false,
        billOccurrences: true,
      },
    },
    {
      job: 'all',
      called: {
        notifications: true,
        billReminders: true,
        balance: true,
        digest: true,
        dailyPush: true,
        renewalReminders: true,
        pluggySync: true,
        billOccurrences: true,
      },
    },
  ])('runs selected jobs for job=$job', async ({ job, called }) => {
    const request = new Request(`http://localhost/api/cron/daily?job=${job}`, {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(processPendingNotificationJobs).toHaveBeenCalledTimes(called.notifications ? 1 : 0);
    expect(scheduleBillReminderNotifications).toHaveBeenCalledTimes(called.billReminders ? 1 : 0);
    expect(reconcileAllAccountBalances).toHaveBeenCalledTimes(called.balance ? 1 : 0);
    expect(sendAllDailyDigests).toHaveBeenCalledTimes(called.digest ? 1 : 0);
    expect(sendAllDailyPushes).toHaveBeenCalledTimes(called.dailyPush ? 1 : 0);
    expect(sendRenewalReminders).toHaveBeenCalledTimes(called.renewalReminders ? 1 : 0);
    expect(runPluggyCronSync).toHaveBeenCalledTimes(called.pluggySync ? 1 : 0);
    expect(updateOccurrenceStatuses).toHaveBeenCalledTimes(called.billOccurrences ? 1 : 0);
    expect(generateFutureOccurrences).toHaveBeenCalledTimes(called.billOccurrences ? 1 : 0);

    expect(body.notifications).toEqual(called.notifications ? { processed: 1, failed: 0 } : null);
    expect(body.billReminders).toEqual(called.billReminders ? { scheduled: 3, skipped: 1 } : null);
    expect(body.balanceReconciliation).toEqual(called.balance ? { updated: 2 } : null);
    expect(body.dailyDigest).toEqual(
      called.digest ? { success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] } : null
    );
    expect(body.dailyPush).toEqual(called.dailyPush ? { success: true, sent: 1 } : null);
    expect(body.renewalReminders).toEqual(called.renewalReminders ? { success: true, sent: 1, skipped: 0, errors: 0 } : null);
    expect(body.pluggySync).toEqual(called.pluggySync ? { success: true } : null);
    expect(body.billOccurrences).toEqual(
      called.billOccurrences ? { updated: 1, skipped: 0, created: 2 } : null
    );
  });

  it('returns 200 with partial success when a job throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendAllDailyDigests.mockRejectedValue(new Error('boom'));

    const request = new Request('http://localhost/api/cron/daily?job=daily-digest', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    // Promise.allSettled allows partial success - cron continues even if one job fails
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.dailyDigest).toBe(null); // Failed job returns null
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[cron:daily] daily-digest failed:'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
