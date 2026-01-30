import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface PaymentFailedEmailData {
  planName: string;
  gracePeriodDate: string; // formatted date
  appUrl: string;
  locale?: Locale;
}

const COLORS = {
  bg: '#f0f0f0',
  fg: '#1a1a1a',
  card: '#ffffff',
  border: '#666666',
  muted: '#888888',
  accent: '#3b82f6',
  error: '#ef4444',
};

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generatePaymentFailedHtml(data: PaymentFailedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.paymentFailed.title');
  const greeting = t('emails.paymentFailed.greeting');
  const intro = t('emails.paymentFailed.intro', { plan: data.planName });
  const actionNeeded = t('emails.paymentFailed.actionNeeded');
  const step1 = t('emails.paymentFailed.step1');
  const step2 = t('emails.paymentFailed.step2');
  const gracePeriod = t('emails.paymentFailed.gracePeriod', { date: data.gracePeriodDate });
  const updatePayment = t('emails.paymentFailed.updatePayment');
  const footerText = t('emails.paymentFailed.footer');

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'JetBrains Mono', monospace; background: ${COLORS.bg}; font-size: 14px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid ${COLORS.error}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.error}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Warning Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 16px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(actionNeeded)}</p>
      <ul style="margin: 0 0 16px 0; padding-left: 20px; color: ${COLORS.fg};">
        <li style="margin: 4px 0;">${escapeHtml(step1)}</li>
        <li style="margin: 4px 0;">${escapeHtml(step2)}</li>
      </ul>

      <!-- Grace Period Notice -->
      <div style="background: #fef2f2; border-left: 4px solid ${COLORS.error}; padding: 12px; margin-top: 16px;">
        <p style="margin: 0; color: ${COLORS.fg}; font-size: 13px;">
          ${escapeHtml(gracePeriod)}
        </p>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/billing" style="display: inline-block; background: ${COLORS.error}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.error};">
        ${escapeHtml(updatePayment)}
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid ${COLORS.border}; padding-top: 16px; text-align: center;">
      <p style="color: ${COLORS.muted}; font-size: 12px; margin: 0;">
        ${escapeHtml(footerText)}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generatePaymentFailedText(data: PaymentFailedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.paymentFailed.title');
  const greeting = t('emails.paymentFailed.greeting');
  const intro = t('emails.paymentFailed.intro', { plan: data.planName });
  const actionNeeded = t('emails.paymentFailed.actionNeeded');
  const step1 = t('emails.paymentFailed.step1');
  const step2 = t('emails.paymentFailed.step2');
  const gracePeriod = t('emails.paymentFailed.gracePeriod', { date: data.gracePeriodDate });
  const updatePayment = t('emails.paymentFailed.updatePayment');
  const footerText = t('emails.paymentFailed.footer');

  return `
${title}

${greeting}

${intro}

${actionNeeded}
• ${step1}
• ${step2}

⚠️  ${gracePeriod}

${updatePayment}: ${data.appUrl}/settings/billing

---
${footerText}
  `.trim();
}
