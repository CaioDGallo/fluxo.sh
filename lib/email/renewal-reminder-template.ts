import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { escapeHtml } from './utils';

export interface RenewalReminderEmailData {
  planName: string;
  renewalDate: string; // formatted date
  amountDisplay: string; // 'R$ 29,90'
  paymentMethodLast4?: string; // last 4 digits of card
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
};

export function generateRenewalReminderHtml(data: RenewalReminderEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.renewalReminder.title');
  const greeting = t('emails.renewalReminder.greeting');
  const intro = t('emails.renewalReminder.intro', {
    plan: data.planName,
    date: data.renewalDate,
  });
  const amountLabel = t('emails.renewalReminder.amountLabel');
  const dateLabel = t('emails.renewalReminder.dateLabel');
  const paymentMethod = t('emails.renewalReminder.paymentMethod');
  const manageSubscription = t('emails.renewalReminder.manageSubscription');
  const footerText = t('emails.renewalReminder.footer');

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
    <div style="border-bottom: 2px solid ${COLORS.accent}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.accent}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Reminder Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 20px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <!-- Renewal Details -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(dateLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">${escapeHtml(data.renewalDate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(amountLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.accent}; font-weight: 700; text-align: right; font-size: 16px;">${escapeHtml(data.amountDisplay)}</td>
          </tr>
          ${
            data.paymentMethodLast4
              ? `<tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(paymentMethod)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">•••• ${escapeHtml(data.paymentMethodLast4)}</td>
          </tr>`
              : ''
          }
        </table>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/billing" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${escapeHtml(manageSubscription)}
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

export function generateRenewalReminderText(data: RenewalReminderEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.renewalReminder.title');
  const greeting = t('emails.renewalReminder.greeting');
  const intro = t('emails.renewalReminder.intro', {
    plan: data.planName,
    date: data.renewalDate,
  });
  const amountLabel = t('emails.renewalReminder.amountLabel');
  const dateLabel = t('emails.renewalReminder.dateLabel');
  const paymentMethod = t('emails.renewalReminder.paymentMethod');
  const manageSubscription = t('emails.renewalReminder.manageSubscription');
  const footerText = t('emails.renewalReminder.footer');

  return `
${title}

${greeting}

${intro}

${dateLabel}: ${data.renewalDate}
${amountLabel}: ${data.amountDisplay}
${data.paymentMethodLast4 ? `${paymentMethod}: •••• ${data.paymentMethodLast4}` : ''}

${manageSubscription}: ${data.appUrl}/settings/billing

---
${footerText}
  `.trim();
}
