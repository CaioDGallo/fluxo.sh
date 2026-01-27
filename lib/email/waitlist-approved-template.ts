import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface WaitlistApprovedEmailData {
  inviteCode: string;
  appUrl: string;
  expiresInDays: number;
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

export function generateWaitlistApprovedHtml(data: WaitlistApprovedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.waitlistApproved.title');
  const greeting = t('emails.waitlistApproved.greeting');
  const intro = t('emails.waitlistApproved.intro');
  const codeLabel = t('emails.waitlistApproved.codeLabel');
  const expires = t('emails.waitlistApproved.expires', { days: data.expiresInDays });
  const instructions = t('emails.waitlistApproved.instructions');
  const cta = t('emails.waitlistApproved.cta');
  const footerText = t('emails.waitlistApproved.footer');

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
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.fg}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 16px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <div style="border: 2px dashed ${COLORS.border}; padding: 16px; margin: 16px 0; background: ${COLORS.bg};">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.muted}; margin-bottom: 8px;">${escapeHtml(codeLabel)}</div>
        <div style="font-size: 20px; font-weight: 700; color: ${COLORS.fg};">${escapeHtml(data.inviteCode)}</div>
        <div style="margin-top: 8px; font-size: 12px; color: ${COLORS.muted};">${escapeHtml(expires)}</div>
      </div>

      <p style="margin: 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(instructions)}</p>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/signup" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${escapeHtml(cta)}
      </a>
    </div>

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

export function generateWaitlistApprovedText(data: WaitlistApprovedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.waitlistApproved.title');
  const greeting = t('emails.waitlistApproved.greeting');
  const intro = t('emails.waitlistApproved.intro');
  const codeLabel = t('emails.waitlistApproved.codeLabel');
  const expires = t('emails.waitlistApproved.expires', { days: data.expiresInDays });
  const instructions = t('emails.waitlistApproved.instructions');
  const cta = t('emails.waitlistApproved.cta');
  const footerText = t('emails.waitlistApproved.footer');

  return `
${title}

${greeting}

${intro}

${codeLabel}: ${data.inviteCode}
${expires}

${instructions}
${cta}: ${data.appUrl}/signup

---
${footerText}
  `.trim();
}
