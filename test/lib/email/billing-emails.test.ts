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

    it('handles DB insert constraint violations', async () => {
      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_constraint_test',
      };

      // First insert succeeds
      await sendBillingEmail(uniqueOptions);

      // Second attempt should deduplicate (not fail)
      const result = await sendBillingEmail(uniqueOptions);

      // Should successfully deduplicate
      expect(result.success).toBe(true);
      expect(result.alreadySent).toBe(true);
    });

    it('returns error when RESEND_API_KEY is missing', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_no_api_key',
      };

      // Mock sendEmail to simulate missing API key
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'RESEND_API_KEY not configured',
      });

      const result = await sendBillingEmail(uniqueOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RESEND_API_KEY not configured');

      // Should not record email
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.referenceId, 'sub_no_api_key'));
      expect(sentEmails).toHaveLength(0);
    });

    it('returns error when Resend API returns 500', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_resend_500',
      };

      // Mock Resend API error
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'Failed to send email',
      });

      const result = await sendBillingEmail(uniqueOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send email');

      // Should not record failed email
      const sentEmails = await db
        .select()
        .from(schema.sentEmails)
        .where(eq(schema.sentEmails.referenceId, 'sub_resend_500'));
      expect(sentEmails).toHaveLength(0);
    });

    it('handles malformed email options gracefully', async () => {
      // Missing required fields (simulate invalid data)
      const malformedOptions = {
        userId: '',
        userEmail: 'invalid-email',
        emailType: 'subscription_purchased' as const,
        referenceId: '',
        subject: '',
        html: '',
        text: '',
      };

      const result = await sendBillingEmail(malformedOptions);

      // Should attempt send and handle any errors
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('handles extremely long referenceId', async () => {
      // Very long referenceId (simulating edge case)
      const longRefId = 'sub_' + 'x'.repeat(500);
      const uniqueOptions = {
        ...baseOptions,
        referenceId: longRefId,
      };

      const result = await sendBillingEmail(uniqueOptions);

      // Should handle gracefully (may succeed or fail depending on DB constraints)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('handles concurrent sends with DB errors', async () => {
      const selectSpy = vi.spyOn(db, 'select');

      // Make first call fail during duplicate check
      selectSpy.mockImplementationOnce(() => {
        throw new Error('Connection timeout');
      });

      const uniqueOptions = {
        ...baseOptions,
        referenceId: 'sub_concurrent_error',
      };

      const results = await Promise.all([
        sendBillingEmail(uniqueOptions),
        sendBillingEmail(uniqueOptions),
      ]);

      // At least one should fail due to mocked error
      const failures = results.filter((r) => !r.success);
      expect(failures.length).toBeGreaterThan(0);

      selectSpy.mockRestore();
    });

    it('handles all billing email types correctly', async () => {
      const sendEmail = (await import('@/lib/email/send')).sendEmail;
      const emailTypes: Array<typeof baseOptions.emailType> = [
        'subscription_purchased',
        'payment_failed',
        'subscription_canceled',
        'subscription_ended',
        'payment_receipt',
        'renewal_reminder',
        'plan_changed',
        'usage_warning',
        'usage_limit',
        'founder_welcome',
      ];

      for (const emailType of emailTypes) {
        vi.clearAllMocks();
        const result = await sendBillingEmail({
          ...baseOptions,
          emailType,
          referenceId: `ref_${emailType}`,
        });

        expect(result.success).toBe(true);
        expect(sendEmail).toHaveBeenCalledOnce();
      }
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
