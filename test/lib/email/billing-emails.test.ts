import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

let db: ReturnType<typeof getTestDb>;
let sendBillingEmail: typeof import('@/lib/email/billing-emails').sendBillingEmail;
let getUserLocale: typeof import('@/lib/email/billing-emails').getUserLocale;

// Mock sendEmail module before any imports
vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Billing Emails - Deduplication', () => {
  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));

    // Import after mocks are set up
    const billingEmails = await import('@/lib/email/billing-emails');
    sendBillingEmail = billingEmails.sendBillingEmail;
    getUserLocale = billingEmails.getUserLocale;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  describe('sendBillingEmail', () => {
    const baseOptions = {
      userId: 'user-123',
      userEmail: 'user@example.com',
      emailType: 'subscription_purchased' as const,
      referenceId: 'sub_123',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
      text: 'Test text',
    };

    it('sends email successfully on first call', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const result = await sendBillingEmail(baseOptions);

      expect(result.success).toBe(true);
      expect(result.alreadySent).toBeUndefined();
      expect(sendEmail).toHaveBeenCalledOnce();
      expect(sendEmail).toHaveBeenCalledWith({
        to: baseOptions.userEmail,
        subject: baseOptions.subject,
        html: baseOptions.html,
        text: baseOptions.text,
      });
    });

    it('records sent email in database', async () => {
      await sendBillingEmail(baseOptions);

      const sentEmails = await db.select().from(schema.sentEmails);
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]?.userId).toBe(baseOptions.userId);
      expect(sentEmails[0]?.emailType).toBe(baseOptions.emailType);
      expect(sentEmails[0]?.referenceId).toBe(baseOptions.referenceId);
    });

    it('skips duplicate sends (same userId, emailType, referenceId)', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await sendBillingEmail(baseOptions);
      vi.clearAllMocks();

      const result = await sendBillingEmail(baseOptions);

      expect(result.success).toBe(true);
      expect(result.alreadySent).toBe(true);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('allows sending same email type with different referenceId', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      await sendBillingEmail(baseOptions);
      vi.clearAllMocks();

      const result = await sendBillingEmail({
        ...baseOptions,
        referenceId: 'sub_456', // Different reference
      });

      expect(result.success).toBe(true);
      expect(result.alreadySent).toBeUndefined();
      expect(sendEmail).toHaveBeenCalledOnce();

      const sentEmails = await db.select().from(schema.sentEmails);
      expect(sentEmails).toHaveLength(2);
    });

    it('allows sending different email types for same referenceId', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;

      // First send
      await sendBillingEmail(baseOptions);

      // Clear mocks but not DB (intentional - testing different email type)
      vi.clearAllMocks();

      // Second send with different email type
      const result = await sendBillingEmail({
        ...baseOptions,
        emailType: 'payment_failed' as const,
      });

      expect(result.success).toBe(true);
      expect(result.alreadySent).toBeUndefined();
      expect(sendEmail).toHaveBeenCalledOnce();

      const sentEmails = await db.select().from(schema.sentEmails);
      expect(sentEmails.length).toBeGreaterThanOrEqual(2);
    });

    it('handles concurrent duplicate sends (race condition)', async () => {
      // Use unique referenceId for this test
      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_concurrent_test',
      };

      // Simulate concurrent webhook retries
      const results = await Promise.all([
        sendBillingEmail(uniqueOptions),
        sendBillingEmail(uniqueOptions),
        sendBillingEmail(uniqueOptions),
      ]);

      // Count different result types
      const successSent = results.filter((r) => r.success && !r.alreadySent).length;
      const successDupe = results.filter((r) => r.success && r.alreadySent).length;
      const failed = results.filter((r) => !r.success).length;

      // Exactly one should successfully send (not fail)
      // The others may either:
      // - Successfully deduplicate (alreadySent: true), OR
      // - Fail with DB constraint error (success: false)
      // This is acceptable behavior for truly concurrent writes
      expect(successSent).toBe(1);
      expect(successSent + successDupe + failed).toBe(3);

      // Only one email should be recorded for this specific referenceId
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.referenceId, 'sub_concurrent_test'));
      expect(sentEmails).toHaveLength(1);
    });

    it('returns error when sendEmail fails', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_fail_test',
      };

      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'API error',
      });

      const result = await sendBillingEmail(uniqueOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');

      // Should not record failed sends for this referenceId
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.referenceId, 'sub_fail_test'));
      expect(sentEmails).toHaveLength(0);
    });

    it('handles DB errors gracefully', async () => {
      // Mock DB select to fail (simulating connection issue during duplicate check)
      const selectSpy = vi.spyOn(db, 'select');
      selectSpy.mockImplementationOnce(() => {
        throw new Error('DB connection lost');
      });

      const result = await sendBillingEmail(baseOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      selectSpy.mockRestore();
    });
  });

  describe('getUserLocale', () => {
    it('returns user locale from settings', async () => {
      await db.insert(schema.userSettings).values({
        userId: 'user-123',
        locale: 'en',
      });

      const locale = await getUserLocale('user-123');
      expect(locale).toBe('en');
    });

    it('returns default locale (pt-BR) when user has no settings', async () => {
      const locale = await getUserLocale('user-nonexistent');
      expect(locale).toBe('pt-BR');
    });

    it('returns default locale when DB query fails', async () => {
      const selectSpy = vi.spyOn(db, 'select');
      selectSpy.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const locale = await getUserLocale('user-123');
      expect(locale).toBe('pt-BR');

      selectSpy.mockRestore();
    });
  });
});
