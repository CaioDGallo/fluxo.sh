import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface SubscriptionEndedEmailData {
  planName: string;
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

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateSubscriptionEndedHtml(data: SubscriptionEndedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.subscriptionEnded.title');
  const greeting = t('emails.subscriptionEnded.greeting', { plan: data.planName });
  const intro = t('emails.subscriptionEnded.intro');
  const freePlan = t('emails.subscriptionEnded.freePlan');
  const limitation = t('emails.subscriptionEnded.limitation');
  const winBack = t('emails.subscriptionEnded.winBack');
  const upgrade = t('emails.subscriptionEnded.upgrade');
  const footerText = t('emails.subscriptionEnded.footer');

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
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.fg}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 16px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <!-- Free Plan Notice -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(freePlan)}</p>
        <p style="margin: 0; color: ${COLORS.muted}; font-size: 13px;">${escapeHtml(limitation)}</p>
      </div>

      <p style="margin: 0; color: ${COLORS.fg}; font-size: 16px; font-weight: 500;">${escapeHtml(winBack)}</p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/billing" style="display: inline-block; background: ${COLORS.accent}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.accent};">
        ${escapeHtml(upgrade)}
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

export function generateSubscriptionEndedText(data: SubscriptionEndedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.subscriptionEnded.title');
  const greeting = t('emails.subscriptionEnded.greeting', { plan: data.planName });
  const intro = t('emails.subscriptionEnded.intro');
  const freePlan = t('emails.subscriptionEnded.freePlan');
  const limitation = t('emails.subscriptionEnded.limitation');
  const winBack = t('emails.subscriptionEnded.winBack');
  const upgrade = t('emails.subscriptionEnded.upgrade');
  const footerText = t('emails.subscriptionEnded.footer');

  return `
${title}

${greeting}

${intro}

${freePlan}
${limitation}

${winBack}

${upgrade}: ${data.appUrl}/settings/billing

---
${footerText}
  `.trim();
}
