import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface UsageLimitEmailData {
  featureName: string; // 'importações' or 'imports'
  limit: number;
  planName: string;
  resetDate: string; // formatted date
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

export function generateUsageLimitHtml(data: UsageLimitEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.usageLimit.title');
  const greeting = t('emails.usageLimit.greeting');
  const intro = t('emails.usageLimit.intro', {
    limit: data.limit,
    feature: data.featureName,
    plan: data.planName,
  });
  const blocked = t('emails.usageLimit.blocked');
  const blockedAction = t('emails.usageLimit.blockedAction');
  const whenReset = t('emails.usageLimit.whenReset');
  const resetDate = t('emails.usageLimit.resetDate', { date: data.resetDate });
  const upgradeNow = t('emails.usageLimit.upgradeNow');
  const unlimitedFeature = t('emails.usageLimit.unlimitedFeature');
  const moreFeatures = t('emails.usageLimit.moreFeatures');
  const viewPlans = t('emails.usageLimit.viewPlans');
  const footerText = t('emails.usageLimit.footer');

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

    <!-- Limit Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 20px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <!-- Blocked Notice -->
      <div style="background: #fef2f2; border-left: 4px solid ${COLORS.error}; padding: 12px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(blocked)}</p>
        <p style="margin: 0; color: ${COLORS.fg}; font-size: 13px;">• ${escapeHtml(blockedAction)}</p>
      </div>

      <!-- Reset Info -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(whenReset)}</p>
        <p style="margin: 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(resetDate)}</p>
      </div>

      <!-- Upgrade Section -->
      <p style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(upgradeNow)}</p>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.fg};">
        <li style="margin: 4px 0;">${escapeHtml(unlimitedFeature)}</li>
        <li style="margin: 4px 0;">${escapeHtml(moreFeatures)}</li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/plan" style="display: inline-block; background: ${COLORS.accent}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.accent};">
        ${escapeHtml(viewPlans)}
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

export function generateUsageLimitText(data: UsageLimitEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.usageLimit.title');
  const greeting = t('emails.usageLimit.greeting');
  const intro = t('emails.usageLimit.intro', {
    limit: data.limit,
    feature: data.featureName,
    plan: data.planName,
  });
  const blocked = t('emails.usageLimit.blocked');
  const blockedAction = t('emails.usageLimit.blockedAction');
  const whenReset = t('emails.usageLimit.whenReset');
  const resetDate = t('emails.usageLimit.resetDate', { date: data.resetDate });
  const upgradeNow = t('emails.usageLimit.upgradeNow');
  const unlimitedFeature = t('emails.usageLimit.unlimitedFeature');
  const moreFeatures = t('emails.usageLimit.moreFeatures');
  const viewPlans = t('emails.usageLimit.viewPlans');
  const footerText = t('emails.usageLimit.footer');

  return `
${title}

${greeting}

${intro}

🚫 ${blocked}
• ${blockedAction}

${whenReset}
${resetDate}

${upgradeNow}
• ${unlimitedFeature}
• ${moreFeatures}

${viewPlans}: ${data.appUrl}/settings/plan

---
${footerText}
  `.trim();
}
