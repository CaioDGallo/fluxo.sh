import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';

const processPendingNotificationJobs = vi.fn();
const scheduleBillReminderNotifications = vi.fn();
const reconcileAllAccountBalances = vi.fn();
const updatePastItemStatuses = vi.fn();
const syncAllUsersCalendars = vi.fn();
const sendAllDailyDigests = vi.fn();
const sendRenewalReminders = vi.fn();
const sendAllDailyPushes = vi.fn();

vi.mock('@/lib/actions/notification-jobs', () => ({ processPendingNotificationJobs }));
vi.mock('@/lib/actions/bill-reminder-jobs', () => ({ scheduleBillReminderNotifications }));
vi.mock('@/lib/actions/accounts', () => ({ reconcileAllAccountBalances }));
vi.mock('@/lib/actions/status-updates', () => ({ updatePastItemStatuses }));
vi.mock('@/lib/actions/calendar-sync', () => ({ syncAllUsersCalendars }));
vi.mock('@/lib/actions/daily-digest', () => ({ sendAllDailyDigests }));
vi.mock('@/lib/actions/renewal-reminders', () => ({ sendRenewalReminders }));
vi.mock('@/lib/actions/daily-push', () => ({ sendAllDailyPushes }));

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
    updatePastItemStatuses.mockResolvedValue({ eventsCompleted: 1, tasksMarkedOverdue: 1 });
    syncAllUsersCalendars.mockResolvedValue([{ success: true }]);
    sendAllDailyDigests.mockResolvedValue({ success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] });
    sendRenewalReminders.mockResolvedValue({ success: true, sent: 1, skipped: 0, errors: 0 });
    sendAllDailyPushes.mockResolvedValue({ success: true, sent: 1 });
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
        status: false,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'bill-reminders',
      called: {
        notifications: false,
        billReminders: true,
        balance: false,
        status: false,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'status-updates',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        status: true,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'calendar-sync',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        status: false,
        calendar: true,
        digest: false,
      },
    },
    {
      job: 'balance-reconciliation',
      called: {
        notifications: false,
        billReminders: false,
        balance: true,
        status: false,
        calendar: false,
        digest: false,
      },
    },
    {
      job: 'daily-digest',
      called: {
        notifications: false,
        billReminders: false,
        balance: false,
        status: false,
        calendar: false,
        digest: true,
      },
    },
    {
      job: 'all',
      called: {
        notifications: true,
        billReminders: true,
        balance: true,
        status: true,
        calendar: true,
        digest: true,
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
    expect(updatePastItemStatuses).toHaveBeenCalledTimes(called.status ? 1 : 0);
    expect(syncAllUsersCalendars).toHaveBeenCalledTimes(called.calendar ? 1 : 0);
    expect(sendAllDailyDigests).toHaveBeenCalledTimes(called.digest ? 1 : 0);

    expect(body.notifications).toEqual(called.notifications ? { processed: 1, failed: 0 } : null);
    expect(body.billReminders).toEqual(called.billReminders ? { scheduled: 3, skipped: 1 } : null);
    expect(body.balanceReconciliation).toEqual(called.balance ? { updated: 2 } : null);
    expect(body.statusUpdates).toEqual(called.status ? { eventsCompleted: 1, tasksMarkedOverdue: 1 } : null);
    expect(body.calendarSync).toEqual(called.calendar ? [{ success: true }] : null);
    expect(body.dailyDigest).toEqual(
      called.digest ? { success: true, usersProcessed: 1, emailsSent: 1, emailsFailed: 0, errors: [] } : null
    );
  });

  it('returns 500 when a job throws', async () => {
    updatePastItemStatuses.mockRejectedValue(new Error('boom'));

    const request = new Request('http://localhost/api/cron/daily?job=status-updates', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
