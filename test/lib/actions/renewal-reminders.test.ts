import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { users } from '@/lib/auth-schema';

let db: ReturnType<typeof getTestDb>;
let sendRenewalReminders: typeof import('@/lib/actions/renewal-reminders').sendRenewalReminders;

// Mock dependencies
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        items: {
          data: [{ price: { unit_amount: 2990 } }],
        },
      }),
    },
  },
}));

describe('Renewal Reminders - Date Logic', () => {
  beforeAll(async () => {
    db = await setupTestDb();
    vi.doMock('@/lib/db', () => ({ db }));

    const renewalReminders = await import('@/lib/actions/renewal-reminders');
    sendRenewalReminders = renewalReminders.sendRenewalReminders;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  const createTestUser = async (id: string, email: string) => {
    await db.insert(users).values({
      id,
      email,
      name: 'Test User',
      passwordHash: 'test-hash', // Required field
    });
  };

  const createSubscription = async (
    userId: string,
    renewalDate: Date,
    status: 'active' | 'past_due' = 'active',
    cancelAtPeriodEnd = false
  ) => {
    const startDate = new Date(renewalDate);
    startDate.setDate(startDate.getDate() - 30); // 30 days before renewal

    await db.insert(schema.billingSubscriptions).values({
      userId,
      planKey: 'saver',
      status,
      currentPeriodStart: startDate,
      currentPeriodEnd: renewalDate,
      cancelAtPeriodEnd,
      stripeSubscriptionId: `sub_${userId}`,
      stripePriceId: 'price_test',
      stripeProductId: 'prod_test',
    });
  };

  describe('3-day window calculation', () => {
    it('includes subscriptions renewing exactly 3 days from now', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z'); // Exactly 3 days
      await createTestUser('user-1', 'user1@test.com');
      await createSubscription('user-1', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);

      vi.useRealTimers();
    });

    it('excludes subscriptions renewing in 2 days', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-01T12:00:00.000Z'); // 2 days
      await createTestUser('user-2days', 'user2days@test.com');
      await createSubscription('user-2days', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);

      vi.useRealTimers();
    });

    it('excludes subscriptions renewing in 4 days', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-03T12:00:00.000Z'); // 4 days
      await createTestUser('user-4days', 'user4days@test.com');
      await createSubscription('user-4days', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);

      vi.useRealTimers();
    });

    it('includes subscriptions at start of 3-day window (00:00:00)', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T00:00:00.000Z'); // Start of day
      await createTestUser('user-start', 'userstart@test.com');
      await createSubscription('user-start', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);

      vi.useRealTimers();
    });

    it('includes subscriptions at end of 3-day window (23:59:59)', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T23:59:59.999Z'); // End of day
      await createTestUser('user-end', 'userend@test.com');
      await createSubscription('user-end', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);

      vi.useRealTimers();
    });

    it('handles multiple subscriptions in same window', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T10:00:00.000Z');

      await createTestUser('user-multi-1', 'usermulti1@test.com');
      await createTestUser('user-multi-2', 'usermulti2@test.com');
      await createTestUser('user-multi-3', 'usermulti3@test.com');

      await createSubscription('user-multi-1', renewalDate);
      await createSubscription('user-multi-2', new Date('2026-02-02T14:00:00.000Z'));
      await createSubscription('user-multi-3', new Date('2026-02-02T20:00:00.000Z'));

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(3);

      vi.useRealTimers();
    });
  });

  describe('subscription filtering', () => {
    it('only sends to active subscriptions', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');

      await createTestUser('user-active', 'active@test.com');
      await createTestUser('user-past-due', 'pastdue@test.com');

      await createSubscription('user-active', renewalDate, 'active');
      await createSubscription('user-past-due', renewalDate, 'past_due');

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1); // Only active

      vi.useRealTimers();
    });

    it('excludes subscriptions marked for cancellation', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');

      await createTestUser('user-renew', 'renew@test.com');
      await createTestUser('user-cancel', 'cancel@test.com');

      await createSubscription('user-renew', renewalDate, 'active', false);
      await createSubscription('user-cancel', renewalDate, 'active', true);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1); // Only non-canceled

      vi.useRealTimers();
    });

    it('skips orphaned subscriptions (user deleted)', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');

      // Create subscription without user (orphaned)
      await createSubscription('user-nonexistent', renewalDate);

      const result = await sendRenewalReminders();

      // Should succeed but find no eligible subscriptions (inner join excludes orphans)
      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('UTC timestamp handling', () => {
    it('handles renewal dates in UTC correctly', async () => {
      const now = new Date('2026-01-30T23:30:00.000Z'); // Late UTC evening
      vi.setSystemTime(now);

      // 3 days from late evening should be Feb 2nd late evening
      const renewalDate = new Date('2026-02-02T23:30:00.000Z');

      await createTestUser('user-utc', 'userutc@test.com');
      await createSubscription('user-utc', renewalDate);

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);

      vi.useRealTimers();
    });

    it('handles different times of day within the window', async () => {
      const now = new Date('2026-01-30T08:00:00.000Z'); // Morning
      vi.setSystemTime(now);

      await createTestUser('user-morning', 'morning@test.com');
      await createTestUser('user-noon', 'noon@test.com');
      await createTestUser('user-evening', 'evening@test.com');

      await createSubscription('user-morning', new Date('2026-02-02T08:00:00.000Z'));
      await createSubscription('user-noon', new Date('2026-02-02T12:00:00.000Z'));
      await createSubscription('user-evening', new Date('2026-02-02T20:00:00.000Z'));

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(3);

      vi.useRealTimers();
    });
  });

  describe('email deduplication', () => {
    it('does not send duplicate reminders on subsequent runs', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');
      await createTestUser('user-dedup', 'userdedup@test.com');
      await createSubscription('user-dedup', renewalDate);

      // First run
      const result1 = await sendRenewalReminders();
      expect(result1.sent).toBe(1);

      // Second run (should deduplicate)
      const result2 = await sendRenewalReminders();
      expect(result2.sent).toBe(0);
      expect(result2.skipped).toBe(1); // Marked as already sent

      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('continues processing other subscriptions if one has issues', async () => {
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');

      await createTestUser('user-good', 'good@test.com');
      await createSubscription('user-good', renewalDate);

      // Also create an orphaned subscription (no user)
      await createSubscription('user-orphaned', renewalDate);

      const result = await sendRenewalReminders();

      // Should process the valid one, skip the orphaned one (inner join)
      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);

      vi.useRealTimers();
    });

    it('returns success with counts even if some emails fail', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const now = new Date('2026-01-30T12:00:00.000Z');
      vi.setSystemTime(now);

      const renewalDate = new Date('2026-02-02T12:00:00.000Z');

      await createTestUser('user-err-1', 'usererr1@test.com');
      await createTestUser('user-err-2', 'usererr2@test.com');

      await createSubscription('user-err-1', renewalDate);
      await createSubscription('user-err-2', renewalDate);

      // Make one email fail
      vi.mocked(sendEmail)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'API error' });

      const result = await sendRenewalReminders();

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);
      expect(result.errors).toBe(1);

      vi.useRealTimers();
    });
  });
});
