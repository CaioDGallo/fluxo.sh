import { describe, it, expect } from 'vitest';
import {
  generateSubscriptionPurchasedHtml,
  generateSubscriptionPurchasedText,
} from '@/lib/email/subscription-purchased-template';
import {
  generatePaymentFailedHtml,
  generatePaymentFailedText,
} from '@/lib/email/payment-failed-template';
import {
  generateSubscriptionCanceledHtml,
  generateSubscriptionCanceledText,
} from '@/lib/email/subscription-canceled-template';
import {
  generateSubscriptionEndedHtml,
  generateSubscriptionEndedText,
} from '@/lib/email/subscription-ended-template';
import {
  generatePaymentReceiptHtml,
  generatePaymentReceiptText,
} from '@/lib/email/payment-receipt-template';
import {
  generatePlanChangedHtml,
  generatePlanChangedText,
} from '@/lib/email/plan-changed-template';
import {
  generateRenewalReminderHtml,
  generateRenewalReminderText,
} from '@/lib/email/renewal-reminder-template';
import {
  generateUsageWarningHtml,
  generateUsageWarningText,
} from '@/lib/email/usage-warning-template';
import {
  generateUsageLimitHtml,
  generateUsageLimitText,
} from '@/lib/email/usage-limit-template';

describe('Email Templates', () => {
  describe('Subscription Purchased Template', () => {
    const baseData = {
      planName: 'Saver',
      billingPeriod: 'Mensal',
      amountDisplay: 'R$ 29,90',
      nextBillingDate: '30 de janeiro de 2026',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateSubscriptionPurchasedHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.billingPeriod);
      expect(html).toContain(baseData.amountDisplay);
      expect(html).toContain(baseData.nextBillingDate);
      expect(html).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateSubscriptionPurchasedText(baseData);

      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.billingPeriod);
      expect(text).toContain(baseData.amountDisplay);
      expect(text).toContain(baseData.nextBillingDate);
      expect(text).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('escapes HTML in user data', () => {
      const maliciousData = {
        ...baseData,
        planName: '<script>alert("xss")</script>',
      };

      const html = generateSubscriptionPurchasedHtml(maliciousData);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('respects pt-BR locale', () => {
      const html = generateSubscriptionPurchasedHtml({ ...baseData, locale: 'pt-BR' });
      expect(html).toContain('lang="pt-BR"');
    });

    it('respects en locale', () => {
      const html = generateSubscriptionPurchasedHtml({ ...baseData, locale: 'en' });
      expect(html).toContain('lang="en"');
    });

    it('handles missing optional locale (defaults to pt-BR)', () => {
      const html = generateSubscriptionPurchasedHtml(baseData);
      expect(html).toContain('lang="pt-BR"');
    });
  });

  describe('Payment Failed Template', () => {
    const baseData = {
      planName: 'Saver',
      gracePeriodDate: '6 de fevereiro de 2026',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generatePaymentFailedHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.gracePeriodDate);
      expect(html).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generatePaymentFailedText(baseData);

      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.gracePeriodDate);
      expect(text).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('escapes HTML in user data', () => {
      const maliciousData = {
        ...baseData,
        gracePeriodDate: '<img src=x onerror="alert(1)">',
      };

      const html = generatePaymentFailedHtml(maliciousData);

      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });
  });

  describe('Subscription Canceled Template', () => {
    const baseData = {
      planName: 'Saver',
      accessUntilDate: '30 de janeiro de 2026',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateSubscriptionCanceledHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.accessUntilDate);
      expect(html).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateSubscriptionCanceledText(baseData);

      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.accessUntilDate);
      expect(text).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('escapes HTML in user data', () => {
      const maliciousData = {
        ...baseData,
        accessUntilDate: '<iframe src="evil.com"></iframe>',
      };

      const html = generateSubscriptionCanceledHtml(maliciousData);

      expect(html).not.toContain('<iframe');
      expect(html).toContain('&lt;iframe');
    });
  });

  describe('Subscription Ended Template', () => {
    const baseData = {
      planName: 'Saver',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateSubscriptionEndedHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
      expect(html).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateSubscriptionEndedText(baseData);

      expect(text).toContain(baseData.planName);
      expect(text).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('escapes HTML in plan name', () => {
      const maliciousData = {
        ...baseData,
        planName: '<script>alert("xss")</script>',
      };

      const html = generateSubscriptionEndedHtml(maliciousData);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Payment Receipt Template', () => {
    const baseData = {
      invoiceNumber: 'INV-001',
      date: '30 de janeiro de 2026',
      planName: 'Saver',
      amountDisplay: 'R$ 29,90',
      invoiceUrl: 'https://invoice.stripe.com/i/acct_xxx/test_xxx',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generatePaymentReceiptHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.invoiceNumber);
      expect(html).toContain(baseData.date);
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.amountDisplay);
      expect(html).toContain(baseData.invoiceUrl);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generatePaymentReceiptText(baseData);

      expect(text).toContain(baseData.invoiceNumber);
      expect(text).toContain(baseData.date);
      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.amountDisplay);
      expect(text).toContain(baseData.invoiceUrl);
    });

    it('escapes HTML in invoice number', () => {
      const maliciousData = {
        ...baseData,
        invoiceNumber: '<script>document.cookie</script>',
      };

      const html = generatePaymentReceiptHtml(maliciousData);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('formats currency correctly for BRL', () => {
      const html = generatePaymentReceiptHtml(baseData);
      expect(html).toContain('R$');
    });
  });

  describe('Plan Changed Template', () => {
    const baseData = {
      oldPlanName: 'Saver',
      newPlanName: 'Pro',
      isUpgrade: true,
      effectiveDate: '30 de janeiro de 2026',
      newLimits: {
        importWeekly: 200,
        accountsAndCards: 50,
      },
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML for upgrade with all data fields', () => {
      const html = generatePlanChangedHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.oldPlanName);
      expect(html).toContain(baseData.newPlanName);
      expect(html).toContain(baseData.effectiveDate);
      expect(html).toContain(String(baseData.newLimits.importWeekly));
    });

    it('generates valid HTML for downgrade', () => {
      const downgradeData = { ...baseData, isUpgrade: false };
      const html = generatePlanChangedHtml(downgradeData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.oldPlanName);
      expect(html).toContain(baseData.newPlanName);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generatePlanChangedText(baseData);

      expect(text).toContain(baseData.oldPlanName);
      expect(text).toContain(baseData.newPlanName);
      expect(text).toContain(baseData.effectiveDate);
    });

    it('escapes HTML in plan names', () => {
      const maliciousData = {
        ...baseData,
        newPlanName: '<b>Pro</b>',
      };

      const html = generatePlanChangedHtml(maliciousData);

      expect(html).toContain('&lt;b&gt;Pro&lt;/b&gt;');
    });
  });

  describe('Renewal Reminder Template', () => {
    const baseData = {
      planName: 'Saver',
      renewalDate: '3 de fevereiro de 2026',
      amountDisplay: 'R$ 29,90',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateRenewalReminderHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.renewalDate);
      expect(html).toContain(baseData.amountDisplay);
      expect(html).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateRenewalReminderText(baseData);

      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.renewalDate);
      expect(text).toContain(baseData.amountDisplay);
      expect(text).toContain(`${baseData.appUrl}/settings/billing`);
    });

    it('escapes HTML in renewal date', () => {
      const maliciousData = {
        ...baseData,
        renewalDate: '<style>body{display:none}</style>',
      };

      const html = generateRenewalReminderHtml(maliciousData);

      expect(html).not.toContain('<style>');
      expect(html).toContain('&lt;style&gt;');
    });

    it('handles empty amount display gracefully', () => {
      const dataWithoutAmount = { ...baseData, amountDisplay: '' };
      const html = generateRenewalReminderHtml(dataWithoutAmount);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.planName);
    });
  });

  describe('Usage Warning Template', () => {
    const baseData = {
      featureName: 'importações',
      currentUsage: 80,
      limit: 100,
      percentage: 80,
      remaining: 20,
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateUsageWarningHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.featureName);
      expect(html).toContain(String(baseData.currentUsage));
      expect(html).toContain(String(baseData.limit));
      expect(html).toContain(String(baseData.percentage));
      expect(html).toContain(String(baseData.remaining));
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateUsageWarningText(baseData);

      expect(text).toContain(baseData.featureName);
      expect(text).toContain(String(baseData.currentUsage));
      expect(text).toContain(String(baseData.limit));
      expect(text).toContain(String(baseData.remaining));
    });

    it('escapes HTML in feature name', () => {
      const maliciousData = {
        ...baseData,
        featureName: '<marquee>Imports</marquee>',
      };

      const html = generateUsageWarningHtml(maliciousData);

      expect(html).not.toContain('<marquee>');
      expect(html).toContain('&lt;marquee&gt;');
    });

    it('displays usage statistics correctly', () => {
      const html = generateUsageWarningHtml(baseData);
      expect(html).toContain('80'); // current usage
      expect(html).toContain('100'); // limit
      expect(html).toContain('20'); // remaining
    });
  });

  describe('Usage Limit Template', () => {
    const baseData = {
      featureName: 'importações',
      limit: 100,
      planName: 'Saver',
      resetDate: '6 de fevereiro de 2026',
      appUrl: 'https://fluxo.sh',
    };

    it('generates valid HTML with all data fields', () => {
      const html = generateUsageLimitHtml(baseData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(baseData.featureName);
      expect(html).toContain(String(baseData.limit));
      expect(html).toContain(baseData.planName);
      expect(html).toContain(baseData.resetDate);
      expect(html).toContain(`${baseData.appUrl}/settings/plan`);
    });

    it('generates valid plain text with all data fields', () => {
      const text = generateUsageLimitText(baseData);

      expect(text).toContain(baseData.featureName);
      expect(text).toContain(String(baseData.limit));
      expect(text).toContain(baseData.planName);
      expect(text).toContain(baseData.resetDate);
      expect(text).toContain(`${baseData.appUrl}/settings/plan`);
    });

    it('escapes HTML in plan name', () => {
      const maliciousData = {
        ...baseData,
        planName: '<input type="text">',
      };

      const html = generateUsageLimitHtml(maliciousData);

      expect(html).not.toContain('<input');
      expect(html).toContain('&lt;input');
    });

    it('displays limit reached message', () => {
      const html = generateUsageLimitHtml(baseData);
      expect(html).toContain(String(baseData.limit));
    });
  });

  describe('Cross-template validation', () => {
    it('all templates produce non-empty HTML', () => {
      const templates = [
        generateSubscriptionPurchasedHtml({
          planName: 'Saver',
          billingPeriod: 'Mensal',
          amountDisplay: 'R$ 29,90',
          nextBillingDate: '30 de janeiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generatePaymentFailedHtml({
          planName: 'Saver',
          gracePeriodDate: '6 de fevereiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generateSubscriptionCanceledHtml({
          planName: 'Saver',
          accessUntilDate: '30 de janeiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generateSubscriptionEndedHtml({
          planName: 'Saver',
          appUrl: 'https://fluxo.sh',
        }),
        generatePaymentReceiptHtml({
          invoiceNumber: 'INV-001',
          date: '30 de janeiro de 2026',
          planName: 'Saver',
          amountDisplay: 'R$ 29,90',
          invoiceUrl: 'https://invoice.stripe.com/i/test',
          appUrl: 'https://fluxo.sh',
        }),
        generatePlanChangedHtml({
          oldPlanName: 'Saver',
          newPlanName: 'Pro',
          isUpgrade: true,
          effectiveDate: '30 de janeiro de 2026',
          newLimits: { importWeekly: 200, accountsAndCards: 50 },
          appUrl: 'https://fluxo.sh',
        }),
        generateRenewalReminderHtml({
          planName: 'Saver',
          renewalDate: '3 de fevereiro de 2026',
          amountDisplay: 'R$ 29,90',
          appUrl: 'https://fluxo.sh',
        }),
        generateUsageWarningHtml({
          featureName: 'importações',
          currentUsage: 80,
          limit: 100,
          percentage: 80,
          remaining: 20,
          appUrl: 'https://fluxo.sh',
        }),
        generateUsageLimitHtml({
          featureName: 'importações',
          limit: 100,
          planName: 'Saver',
          resetDate: '6 de fevereiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
      ];

      templates.forEach((html) => {
        expect(html).toContain('<!DOCTYPE html>');
        expect(html.length).toBeGreaterThan(100);
      });
    });

    it('all templates produce non-empty plain text', () => {
      const templates = [
        generateSubscriptionPurchasedText({
          planName: 'Saver',
          billingPeriod: 'Mensal',
          amountDisplay: 'R$ 29,90',
          nextBillingDate: '30 de janeiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generatePaymentFailedText({
          planName: 'Saver',
          gracePeriodDate: '6 de fevereiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generateSubscriptionCanceledText({
          planName: 'Saver',
          accessUntilDate: '30 de janeiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
        generateSubscriptionEndedText({
          planName: 'Saver',
          appUrl: 'https://fluxo.sh',
        }),
        generatePaymentReceiptText({
          invoiceNumber: 'INV-001',
          date: '30 de janeiro de 2026',
          planName: 'Saver',
          amountDisplay: 'R$ 29,90',
          invoiceUrl: 'https://invoice.stripe.com/i/test',
          appUrl: 'https://fluxo.sh',
        }),
        generatePlanChangedText({
          oldPlanName: 'Saver',
          newPlanName: 'Pro',
          isUpgrade: true,
          effectiveDate: '30 de janeiro de 2026',
          newLimits: { importWeekly: 200, accountsAndCards: 50 },
          appUrl: 'https://fluxo.sh',
        }),
        generateRenewalReminderText({
          planName: 'Saver',
          renewalDate: '3 de fevereiro de 2026',
          amountDisplay: 'R$ 29,90',
          appUrl: 'https://fluxo.sh',
        }),
        generateUsageWarningText({
          featureName: 'importações',
          currentUsage: 80,
          limit: 100,
          percentage: 80,
          remaining: 20,
          appUrl: 'https://fluxo.sh',
        }),
        generateUsageLimitText({
          featureName: 'importações',
          limit: 100,
          planName: 'Saver',
          resetDate: '6 de fevereiro de 2026',
          appUrl: 'https://fluxo.sh',
        }),
      ];

      templates.forEach((text) => {
        expect(text.length).toBeGreaterThan(50);
      });
    });
  });
});
