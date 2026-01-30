import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { type PlanLimits } from '@/lib/plans';
import { escapeHtml } from './utils';

export interface PlanChangedEmailData {
  oldPlanName: string;
  newPlanName: string;
  isUpgrade: boolean; // true for upgrade, false for downgrade
  effectiveDate: string; // formatted date
  newLimits: PlanLimits;
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
  success: '#10b981',
};

export function generatePlanChangedHtml(data: PlanChangedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.planChanged.title');
  const greeting = t('emails.planChanged.greeting');
  const message = data.isUpgrade
    ? t('emails.planChanged.upgraded', { oldPlan: data.oldPlanName, newPlan: data.newPlanName })
    : t('emails.planChanged.downgraded', { oldPlan: data.oldPlanName, newPlan: data.newPlanName });
  const effectiveDate = t('emails.planChanged.effectiveDate');
  const newLimits = t('emails.planChanged.newLimits');
  const categories = t('emails.planChanged.categories');
  const accounts = t('emails.planChanged.accounts');
  const imports = t('emails.planChanged.imports');
  const viewPlan = t('emails.planChanged.viewPlan');
  const footerText = t('emails.planChanged.footer');

  const accentColor = data.isUpgrade ? COLORS.success : COLORS.accent;

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
    <div style="border-bottom: 2px solid ${accentColor}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${accentColor}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Change Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 20px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(message)}</p>

      <!-- Effective Date -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 12px; margin-bottom: 16px;">
        <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(effectiveDate)}</p>
        <p style="margin: 8px 0 0 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(data.effectiveDate)}</p>
      </div>

      <!-- New Limits -->
      <p style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-weight: 500;">${escapeHtml(newLimits)}</p>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.fg};">
        <li style="margin: 4px 0;">${escapeHtml(categories)}: ${data.newLimits.maxCategories}</li>
        <li style="margin: 4px 0;">${escapeHtml(accounts)}: ${data.newLimits.maxAccounts}</li>
        <li style="margin: 4px 0;">${escapeHtml(imports)}: ${data.newLimits.importWeekly}</li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/settings/plan" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${escapeHtml(viewPlan)}
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

export function generatePlanChangedText(data: PlanChangedEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.planChanged.title');
  const greeting = t('emails.planChanged.greeting');
  const message = data.isUpgrade
    ? t('emails.planChanged.upgraded', { oldPlan: data.oldPlanName, newPlan: data.newPlanName })
    : t('emails.planChanged.downgraded', { oldPlan: data.oldPlanName, newPlan: data.newPlanName });
  const effectiveDate = t('emails.planChanged.effectiveDate');
  const newLimits = t('emails.planChanged.newLimits');
  const categories = t('emails.planChanged.categories');
  const accounts = t('emails.planChanged.accounts');
  const imports = t('emails.planChanged.imports');
  const viewPlan = t('emails.planChanged.viewPlan');
  const footerText = t('emails.planChanged.footer');

  return `
${title}

${greeting}

${message}

${effectiveDate}: ${data.effectiveDate}

${newLimits}
• ${categories}: ${data.newLimits.maxCategories}
• ${accounts}: ${data.newLimits.maxAccounts}
• ${imports}: ${data.newLimits.importWeekly}

${viewPlan}: ${data.appUrl}/settings/plan

---
${footerText}
  `.trim();
}
