import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { escapeHtml } from './utils';

export interface UsageWarningEmailData {
  featureName: string; // 'importações' or 'imports'
  currentUsage: number;
  limit: number;
  percentage: number; // 80, 90, etc.
  remaining: number;
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
  warning: '#f59e0b',
};

export function generateUsageWarningHtml(data: UsageWarningEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.usageWarning.title', { percentage: data.percentage });
  const greeting = t('emails.usageWarning.greeting');
  const intro = t('emails.usageWarning.intro', {
    current: data.currentUsage,
    limit: data.limit,
    feature: data.featureName,
    percentage: data.percentage,
  });
  const featureLabel = t('emails.usageWarning.featureLabel');
  const currentUsage = t('emails.usageWarning.currentUsage');
  const remaining = t('emails.usageWarning.remaining');
  const whatHappens = t('emails.usageWarning.whatHappens');
  const blocked = t('emails.usageWarning.blocked');
  const upgrade = t('emails.usageWarning.upgrade');
  const viewPlans = t('emails.usageWarning.viewPlans');
  const footerText = t('emails.usageWarning.footer');

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
    <div style="border-bottom: 2px solid ${COLORS.warning}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.warning}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Warning Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 20px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <!-- Usage Stats -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(featureLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">${escapeHtml(data.featureName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(currentUsage)}</td>
            <td style="padding: 8px 0; color: ${COLORS.warning}; font-weight: 700; text-align: right;">${data.currentUsage} / ${data.limit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(remaining)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">${data.remaining}</td>
          </tr>
        </table>
      </div>

      <!-- Warning Box -->
      <div style="background: #fef3c7; border-left: 4px solid ${COLORS.warning}; padding: 12px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(whatHappens)}</p>
        <p style="margin: 0; color: ${COLORS.fg}; font-size: 13px;">${escapeHtml(blocked)}</p>
      </div>

      <p style="margin: 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(upgrade)}</p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/plan" style="display: inline-block; background: ${COLORS.warning}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.warning};">
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

export function generateUsageWarningText(data: UsageWarningEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.usageWarning.title', { percentage: data.percentage });
  const greeting = t('emails.usageWarning.greeting');
  const intro = t('emails.usageWarning.intro', {
    current: data.currentUsage,
    limit: data.limit,
    feature: data.featureName,
    percentage: data.percentage,
  });
  const featureLabel = t('emails.usageWarning.featureLabel');
  const currentUsage = t('emails.usageWarning.currentUsage');
  const remaining = t('emails.usageWarning.remaining');
  const whatHappens = t('emails.usageWarning.whatHappens');
  const blocked = t('emails.usageWarning.blocked');
  const upgrade = t('emails.usageWarning.upgrade');
  const viewPlans = t('emails.usageWarning.viewPlans');
  const footerText = t('emails.usageWarning.footer');

  return `
${title}

${greeting}

${intro}

${featureLabel}: ${data.featureName}
${currentUsage}: ${data.currentUsage} / ${data.limit}
${remaining}: ${data.remaining}

⚠️  ${whatHappens}
${blocked}

${upgrade}

${viewPlans}: ${data.appUrl}/settings/plan

---
${footerText}
  `.trim();
}
