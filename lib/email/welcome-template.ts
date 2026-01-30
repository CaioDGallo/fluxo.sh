import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { escapeHtml } from './utils';

export interface WelcomeEmailData {
  userName?: string;
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

export function generateWelcomeHtml(data: WelcomeEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.welcome.title');
  const greeting = data.userName
    ? t('emails.welcome.greeting', { name: data.userName })
    : t('emails.welcome.greetingNoName');
  const intro = t('emails.welcome.intro');
  const whatYouCanDo = t('emails.welcome.whatYouCanDo');
  const feature1 = t('emails.welcome.feature1');
  const feature2 = t('emails.welcome.feature2');
  const feature3 = t('emails.welcome.feature3');
  const getStarted = t('emails.welcome.getStarted');
  const footerText = t('emails.welcome.footer');

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
      <h1 style="margin: 0; color: ${COLORS.fg}; font-size: 24px; font-weight: 700;">${title}</h1>
    </div>

    <!-- Welcome Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 16px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(whatYouCanDo)}</p>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.fg};">
        <li style="margin: 4px 0;">${escapeHtml(feature1)}</li>
        <li style="margin: 4px 0;">${escapeHtml(feature2)}</li>
        <li style="margin: 4px 0;">${escapeHtml(feature3)}</li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/dashboard" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${escapeHtml(getStarted)}
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

export function generateWelcomeText(data: WelcomeEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.welcome.title');
  const greeting = data.userName
    ? t('emails.welcome.greeting', { name: data.userName })
    : t('emails.welcome.greetingNoName');
  const intro = t('emails.welcome.intro');
  const whatYouCanDo = t('emails.welcome.whatYouCanDo');
  const feature1 = t('emails.welcome.feature1');
  const feature2 = t('emails.welcome.feature2');
  const feature3 = t('emails.welcome.feature3');
  const getStarted = t('emails.welcome.getStarted');
  const footerText = t('emails.welcome.footer');

  return `
${title}

${greeting}

${intro}

${whatYouCanDo}
• ${feature1}
• ${feature2}
• ${feature3}

${getStarted}: ${data.appUrl}/dashboard

---
${footerText}
  `.trim();
}
