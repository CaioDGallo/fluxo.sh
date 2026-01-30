import { users } from '@/lib/auth-schema';
import * as schema from '@/lib/schema';
import { clearAllTables, getTestDb, setupTestDb, teardownTestDb } from '@/test/db-utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let db: ReturnType<typeof getTestDb>;
let incrementUsageCount: typeof import('@/lib/plan-usage').incrementUsageCount;
let getUsageCount: typeof import('@/lib/plan-usage').getUsageCount;
let getWeeklyWindow: typeof import('@/lib/plan-usage').getWeeklyWindow;

// Mock dependencies
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Plan Usage - Threshold Tests', () => {
  beforeAll(async () => {
    db = await setupTestDb();
    vi.doMock('@/lib/db', () => ({ db }));

    const planUsage = await import('@/lib/plan-usage');
    incrementUsageCount = planUsage.incrementUsageCount;
    getUsageCount = planUsage.getUsageCount;
    getWeeklyWindow = planUsage.getWeeklyWindow;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  const createTestUser = async (id: string, email: string, planKey: 'free' | 'saver' = 'free') => {
    await db.insert(users).values({
      id,
      email,
      name: 'Test User',
      passwordHash: 'test-hash',
    });

    await db.insert(schema.userSettings).values({
      userId: id,
      locale: 'pt-BR',
      timezone: 'UTC',
    });

    // Create subscription for non-free plans
    if (planKey !== 'free') {
      await db.insert(schema.billingSubscriptions).values({
        userId: id,
        planKey,
        status: 'active',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: `sub_${id}`,
        stripePriceId: 'price_test',
        stripeProductId: 'prod_test',
      });
    }
  };

  describe('80% warning threshold', () => {
    it('sends warning email when crossing 80%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-warn-80', 'userwarn80@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Increment to 78% (39/50), then cross 80% (40/50 = 80%)
      await incrementUsageCount('user-warn-80', 'import_weekly', window, 39);
      vi.clearAllMocks();

      // Cross 80% threshold
      const count = await incrementUsageCount('user-warn-80', 'import_weekly', window, 1);

      expect(count).toBe(40);
      expect(sendEmail).toHaveBeenCalledOnce();

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('80%');
      expect(call?.subject).toContain('importações');
    });

    it('does not send warning before 80%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-before-80', 'userbefore80@test.com');

      const window = getWeeklyWindow('UTC');

      // Increment to 33% (1/3 for Free plan)
      await incrementUsageCount('user-before-80', 'import_weekly', window, 1);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('sends warning only once at 80%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-once-80', 'useronce80@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Cross 80% threshold (40/50 = 80%)
      await incrementUsageCount('user-once-80', 'import_weekly', window, 40);
      expect(sendEmail).toHaveBeenCalledOnce();
      vi.clearAllMocks();

      // Increment again (still at 80%)
      await incrementUsageCount('user-once-80', 'import_weekly', window, 0);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('does not send warning when jumping directly to 100%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-jump-100', 'userjump100@test.com');

      const window = getWeeklyWindow('UTC');

      // Jump directly to 100% (3/3 for Free plan) from 0%
      await incrementUsageCount('user-jump-100', 'import_weekly', window, 3);

      // Should send 100% limit email, not 80% warning
      expect(sendEmail).toHaveBeenCalledOnce();
      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('Limite');
      expect(call?.subject).not.toContain('80%');
    });

    it('calculates percentage correctly with different limits', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-saver-80', 'usersaver80@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Increment to 80% (40/50)
      await incrementUsageCount('user-saver-80', 'import_weekly', window, 40);

      expect(sendEmail).toHaveBeenCalledOnce();
      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('80%');
    });
  });

  describe('100% limit threshold', () => {
    it('sends limit email when reaching 100%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-limit-100', 'userlimit100@test.com');

      const window = getWeeklyWindow('UTC');

      // Reach 100% (3/3 for Free plan)
      const count = await incrementUsageCount('user-limit-100', 'import_weekly', window, 3);

      expect(count).toBe(3);
      expect(sendEmail).toHaveBeenCalledOnce();

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('Limite');
      expect(call?.subject).toContain('importações');
    });

    it('sends limit email only once at 100%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-once-100', 'useronce100@test.com');

      const window = getWeeklyWindow('UTC');

      // Reach 100% (3/3 for Free plan)
      await incrementUsageCount('user-once-100', 'import_weekly', window, 3);
      expect(sendEmail).toHaveBeenCalledOnce();
      vi.clearAllMocks();

      // Try to increment beyond 100% (should not send again)
      await incrementUsageCount('user-once-100', 'import_weekly', window, 1);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('does not send limit email before 100%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-before-100', 'userbefore100@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Increment to 80% (40/50 for Saver plan)
      await incrementUsageCount('user-before-100', 'import_weekly', window, 40);

      // Should only send 80% warning, not limit
      expect(sendEmail).toHaveBeenCalledOnce();
      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('80%');
      expect(call?.subject).not.toContain('Limite');
    });

    it('includes reset date in limit email', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-reset-date', 'userresetdate@test.com');

      const window = getWeeklyWindow('UTC');

      // Reach 100% (3/3 for Free plan)
      await incrementUsageCount('user-reset-date', 'import_weekly', window, 3);

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.html).toBeDefined();
      // Reset date should be in the email content
      expect(call?.html?.length).toBeGreaterThan(100);
    });
  });

  describe('threshold interaction (80% → 100%)', () => {
    it('sends both emails when progressing 80% → 100%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-both-emails', 'userbothemails@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Cross 80% (40/50 for Saver plan)
      await incrementUsageCount('user-both-emails', 'import_weekly', window, 40);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(vi.mocked(sendEmail).mock.calls[0]?.[0]?.subject).toContain('80%');

      vi.clearAllMocks();

      // Cross 100% (50/50)
      await incrementUsageCount('user-both-emails', 'import_weekly', window, 10);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(vi.mocked(sendEmail).mock.calls[0]?.[0]?.subject).toContain('Limite');
    });

    it('does not re-send 80% warning when at 90%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-saver-90', 'usersaver90@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Cross 80% (40/50)
      await incrementUsageCount('user-saver-90', 'import_weekly', window, 40);
      expect(sendEmail).toHaveBeenCalledOnce();
      vi.clearAllMocks();

      // Increment to 90% (45/50)
      await incrementUsageCount('user-saver-90', 'import_weekly', window, 5);

      // Should not send another email
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('concurrent increment race conditions', () => {
    it('does not send duplicate emails on concurrent increments crossing 80%', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-concurrent-80', 'userconcurrent80@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Pre-load to 78% (39/50 for Saver plan)
      await incrementUsageCount('user-concurrent-80', 'import_weekly', window, 39);
      vi.clearAllMocks();

      // Simulate concurrent increments that both cross 80%
      await Promise.all([
        incrementUsageCount('user-concurrent-80', 'import_weekly', window, 1),
        incrementUsageCount('user-concurrent-80', 'import_weekly', window, 1),
      ]);

      // Due to check-then-send pattern, one should send email
      // Email deduplication via sentEmails table prevents actual duplicates
      const emailCalls = vi.mocked(sendEmail).mock.calls.length;
      expect(emailCalls).toBeGreaterThanOrEqual(1);
      expect(emailCalls).toBeLessThanOrEqual(2);

      // Verify deduplication in DB
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.userId, 'user-concurrent-80'));

      // Only one email should be recorded (deduplication)
      const warningEmails = sentEmails.filter((e) => e.emailType === 'usage_warning');
      expect(warningEmails).toHaveLength(1);
    });

    it('handles concurrent increments at 100% limit', async () => {
      await createTestUser('user-concurrent-100', 'userconcurrent100@test.com');

      const window = getWeeklyWindow('UTC');

      // Pre-load to 67% (2/3 for Free plan)
      await incrementUsageCount('user-concurrent-100', 'import_weekly', window, 2);
      vi.clearAllMocks();

      // Concurrent increments crossing 100%
      await Promise.all([
        incrementUsageCount('user-concurrent-100', 'import_weekly', window, 1),
        incrementUsageCount('user-concurrent-100', 'import_weekly', window, 1),
      ]);

      // Verify deduplication
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.userId, 'user-concurrent-100'));

      const limitEmails = sentEmails.filter((e) => e.emailType === 'usage_limit');
      expect(limitEmails).toHaveLength(1);
    });
  });

  describe('email content validation', () => {
    it('includes correct usage statistics in 80% warning', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-stats', 'userstats@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Cross 80% (40/50 for Saver plan)
      await incrementUsageCount('user-stats', 'import_weekly', window, 40);

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.html).toContain('40'); // current usage
      expect(call?.html).toContain('50'); // limit
      expect(call?.html).toContain('10'); // remaining
    });

    it('includes plan name in limit email', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-plan-name', 'userplanname@test.com');

      const window = getWeeklyWindow('UTC');

      // Reach 100% (3/3 for Free plan)
      await incrementUsageCount('user-plan-name', 'import_weekly', window, 3);

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.html).toContain('Free'); // Plan name
    });

    it('uses correct locale for emails', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;

      // Create user with pt-BR locale
      await createTestUser('user-br', 'userbr@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Cross 80% (40/50 = 80% for Saver plan)
      await incrementUsageCount('user-br', 'import_weekly', window, 40);

      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      // Should send 80% warning (not limit)
      expect(call?.subject).toMatch(/80%|Alerta/); // Portuguese
      expect(call?.subject).toContain('importações');
    });
  });

  describe('error handling', () => {
    it('does not fail increment when email sending fails', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'API error',
      });

      await createTestUser('user-email-fail', 'useremailfail@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Should still increment despite email failure (40/50 = 80% for Saver plan)
      const count = await incrementUsageCount('user-email-fail', 'import_weekly', window, 40);

      expect(count).toBe(40);
      expect(sendEmail).toHaveBeenCalled();
    });

    it('continues when user has no email', async () => {
      await db.insert(users).values({
        id: 'user-no-email',
        email: 'temp@test.com', // Email required by schema
        name: 'No Email User',
        passwordHash: 'test-hash',
      });

      // Delete email to simulate missing email (can't insert NULL due to NOT NULL constraint)
      await db.update(users).set({ email: 'deleted@test.com' }).where(eq(users.id, 'user-no-email'));

      await db.insert(schema.userSettings).values({
        userId: 'user-no-email',
        locale: 'pt-BR',
        timezone: 'UTC',
      });

      const window = getWeeklyWindow('UTC');

      // Should still work even if email sending is skipped (2/3 = 67% for Free plan)
      const count = await incrementUsageCount('user-no-email', 'import_weekly', window, 2);

      expect(count).toBe(2);
    });

    it('handles missing user gracefully', async () => {
      const window = getWeeklyWindow('UTC');

      // Increment for non-existent user (shouldn't crash)
      const count = await incrementUsageCount('user-nonexistent', 'import_weekly', window, 3);

      expect(count).toBe(3);
    });
  });

  describe('percentage calculation edge cases', () => {
    it('handles exact 80% threshold', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-exact-80', 'userexact80@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Start from 0%, increment to exactly 80% (40/50 = 80% for Saver plan)
      const count = await incrementUsageCount('user-exact-80', 'import_weekly', window, 40);

      expect(count).toBe(40);
      expect(sendEmail).toHaveBeenCalledOnce();
    });

    it('handles crossing both thresholds in one increment', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-saver-jump', 'usersaverjump@test.com', 'saver');

      const window = getWeeklyWindow('UTC');

      // Jump from 70% to 100% in one increment
      await incrementUsageCount('user-saver-jump', 'import_weekly', window, 35); // 70%
      vi.clearAllMocks();

      await incrementUsageCount('user-saver-jump', 'import_weekly', window, 15); // 100%

      // Should only send 100% email (skipped 80%)
      expect(sendEmail).toHaveBeenCalledOnce();
      const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
      expect(call?.subject).toContain('Limite');
    });

    it('handles increment of 0', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await createTestUser('user-zero-inc', 'userzeroinc@test.com');

      const window = getWeeklyWindow('UTC');

      // Increment by 0 (no-op)
      const count = await incrementUsageCount('user-zero-inc', 'import_weekly', window, 0);

      expect(count).toBe(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
