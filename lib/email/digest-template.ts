import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { centsToDisplay } from '@/lib/utils';
import { escapeHtml } from './utils';

export interface CategorySpending {
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string;
  amount: number; // in cents
}

export interface YesterdaySpending {
  total: number; // in cents
  isEmpty: boolean;
  byCategory: CategorySpending[];
}

export interface OverBudgetCategory {
  category: string;
  spent: number; // in cents
  budget: number; // in cents
  overAmount: number; // in cents
}

export interface CriticalBudgetCategory {
  category: string;
  spent: number; // in cents
  budget: number; // in cents
  percentage: number;
  remaining: number; // in cents
}

export interface MonthlyBudgetOverview {
  spent: number; // in cents
  budget: number; // in cents
  percentage: number;
}

export interface BudgetInsights {
  overBudget: OverBudgetCategory[];
  critical: CriticalBudgetCategory[];
  healthyCount: number;
  monthlyOverview: MonthlyBudgetOverview | null;
}

export interface FinancialDigestData {
  date: string;
  yesterday: YesterdaySpending;
  budgets: BudgetInsights;
  appUrl: string;
  timezone: string;
  locale?: Locale;
}

const COLORS = {
  bg: '#f0f0f0',
  fg: '#1a1a1a',
  card: '#ffffff',
  border: '#666666',
  muted: '#888888',
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#888888',
};

const ICON_FALLBACK = '💰';

const CATEGORY_ICON_MAP: Record<string, string> = {
  ShoppingBag01Icon: '🛍️',
  Restaurant01Icon: '🍽️',
  Car01Icon: '🚗',
  Home01Icon: '🏠',
  HealthIcon: '🩺',
  PlaneIcon: '✈️',
  GameController01Icon: '🎮',
  Book01Icon: '📚',
  Wallet01Icon: '👛',
  ClothesIcon: '👕',
  Wifi01Icon: '📶',
  Activity01Icon: '🏃',
  GiftIcon: '🎁',
  SparklesIcon: '✨',
  Settings01Icon: '⚙️',
  Briefcase01Icon: '💼',
  Coffee01Icon: '☕',
  Pizza01Icon: '🍕',
  Dumbbell01Icon: '🏋️',
  Film01Icon: '🎬',
  BankIcon: '🏦',
  Bus01Icon: '🚌',
  MetroIcon: '🚇',
  School01Icon: '🏫',
  ElectricHome01Icon: '💡',
  Cash01Icon: '💵',
  BrushIcon: '🖌️',
  BicycleIcon: '🚲',
  CoffeeBeansIcon: '🫘',
  Medicine01Icon: '💊',
  MusicNote01Icon: '🎵',
  FuelStationIcon: '⛽',
  ParkingAreaCircleIcon: '🅿️',
  HeadphonesIcon: '🎧',
  HeartAddIcon: '❤️',
  Hospital01Icon: '🏥',
};

function formatCurrency(cents: number, locale: Locale): string {
  const value = Number(centsToDisplay(cents));
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function resolveCategoryIcon(icon: string | null): string {
  if (!icon) return ICON_FALLBACK;
  if (icon in CATEGORY_ICON_MAP) return CATEGORY_ICON_MAP[icon];
  if (icon.includes('Icon')) return ICON_FALLBACK;
  return icon;
}

export function generateDigestHtml(data: FinancialDigestData): string {
  const { yesterday, budgets, date, appUrl } = data;
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.digest.title');
  const footerText = t('emails.digest.footer');
  const viewBudgetsLabel = t('emails.digest.viewBudgets');

  // Yesterday's Spending Section
  let yesterdayHtml = '';
  if (yesterday.isEmpty) {
    yesterdayHtml = `
      <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 16px; margin: 0; text-align: center;">
        <p style="margin: 0; color: ${COLORS.fg}; font-size: 14px;">${t('emails.digest.noExpenses')}</p>
      </div>
    `;
  } else {
    const categoryItems = yesterday.byCategory
      .slice(0, 7) // Top 7 categories
      .map(cat => {
        const icon = resolveCategoryIcon(cat.categoryIcon);
        const amount = formatCurrency(cat.amount, locale);
        return `
          <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; border-left: 4px solid ${cat.categoryColor}; padding: 12px 14px; margin-bottom: 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
              <tr>
                <td style="width: 28px; font-size: 18px; line-height: 1;">${icon}</td>
                <td style="color: ${COLORS.fg}; font-size: 13px; font-weight: 500;">${escapeHtml(cat.categoryName)}</td>
                <td align="right" style="color: ${COLORS.fg}; font-size: 14px; font-weight: 700; white-space: nowrap;">${amount}</td>
              </tr>
            </table>
          </div>
        `;
      })
      .join('');

    const total = formatCurrency(yesterday.total, locale);
    yesterdayHtml = `
      <div style="margin-bottom: 12px;">
        <div style="background: ${COLORS.fg}; color: ${COLORS.bg}; border: 2px solid ${COLORS.fg}; padding: 12px 14px; margin-bottom: 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">${t('emails.digest.total')}</td>
              <td align="right" style="font-size: 18px; font-weight: 700; white-space: nowrap;">${total}</td>
            </tr>
          </table>
        </div>
        ${categoryItems}
      </div>
    `;
  }

  // Budget Insights Section
  let budgetHtml = '';
  const hasOverBudget = budgets.overBudget.length > 0;
  const hasCritical = budgets.critical.length > 0;
  const hasMonthly = budgets.monthlyOverview !== null;

  if (hasOverBudget || hasCritical || hasMonthly) {
    // Over Budget (>100%)
    const overBudgetHtml = budgets.overBudget
      .map(cat => {
        const over = formatCurrency(cat.overAmount, locale);
        return `
          <div style="background: ${COLORS.card}; border-left: 4px solid ${COLORS.critical}; padding: 10px 12px; margin: 6px 0;">
            <p style="margin: 0; color: ${COLORS.fg}; font-size: 13px;">⚠️ ${t('emails.digest.overBudget', { category: cat.category, amount: over })}</p>
          </div>
        `;
      })
      .join('');

    // Critical (80-100%)
    const criticalHtml = budgets.critical
      .map(cat => {
        const remaining = formatCurrency(cat.remaining, locale);
        const percent = Math.round(cat.percentage);
        return `
          <div style="background: ${COLORS.card}; border-left: 4px solid ${COLORS.high}; padding: 10px 12px; margin: 6px 0;">
            <p style="margin: 0; color: ${COLORS.fg}; font-size: 13px;">📢 ${t('emails.digest.criticalWarning', { category: cat.category, percent, remaining })}</p>
          </div>
        `;
      })
      .join('');

    // Healthy summary
    const healthyHtml =
      budgets.healthyCount > 0
        ? `
          <div style="background: ${COLORS.card}; border: 1px solid ${COLORS.border}; padding: 10px 12px; margin: 6px 0;">
            <p style="margin: 0; color: ${COLORS.muted}; font-size: 13px;">✓ ${t('emails.digest.healthySummary', { count: budgets.healthyCount })}</p>
          </div>
        `
        : '';

    // Monthly overview
    const monthlyHtml = hasMonthly
      ? (() => {
          const spent = formatCurrency(budgets.monthlyOverview!.spent, locale);
          const budget = formatCurrency(budgets.monthlyOverview!.budget, locale);
          const percent = Math.round(budgets.monthlyOverview!.percentage);
          return `
            <div style="background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px; margin-top: 12px;">
              <p style="margin: 0; font-size: 13px;">${t('emails.digest.monthlyOverview', { spent, budget, percent })}</p>
            </div>
          `;
        })()
      : '';

    budgetHtml = overBudgetHtml + criticalHtml + healthyHtml + monthlyHtml;
  }

  const hasYesterdayData = !yesterday.isEmpty;
  const hasBudgetData = hasOverBudget || hasCritical || hasMonthly;

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - fluxo.sh</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'JetBrains Mono', monospace; background: ${COLORS.bg}; font-size: 14px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-size: 24px; font-weight: bold;">${title}</h1>
      <p style="margin: 0; color: ${COLORS.muted}; font-size: 14px;">${escapeHtml(date)}</p>
    </div>

    ${hasYesterdayData ? `
    <!-- Yesterday's Spending Section -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: bold;">${t('emails.digest.yesterdaySpending')}</h2>
      ${yesterdayHtml}
    </div>
    ` : `
    <!-- No Expenses Yesterday -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: bold;">${t('emails.digest.yesterdaySpending')}</h2>
      ${yesterdayHtml}
    </div>
    `}

    ${hasBudgetData ? `
    <!-- Budget Insights Section -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: bold;">${t('emails.digest.budgetInsights')}</h2>
      ${budgetHtml}
    </div>
    ` : ''}

    <!-- CTA Button -->
    <div style="margin-top: 32px; text-align: center;">
      <a href="${appUrl}/budgets" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 4px 4px 0 ${COLORS.border};">
        ${viewBudgetsLabel}
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid ${COLORS.border}; text-align: center;">
      <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateDigestText(data: FinancialDigestData): string {
  const { yesterday, budgets, date, appUrl } = data;
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  let text = `${t('emails.digest.textTitle')}\n${date}\n\n`;

  // Yesterday's Spending
  text += `${t('emails.digest.yesterdaySpending')}\n${'='.repeat(40)}\n\n`;

  if (yesterday.isEmpty) {
    text += `${t('emails.digest.noExpenses')}\n\n`;
  } else {
    text += `${t('emails.digest.total')}: ${formatCurrency(yesterday.total, locale)}\n\n`;
    yesterday.byCategory.slice(0, 7).forEach(cat => {
      const icon = resolveCategoryIcon(cat.categoryIcon);
      const amount = formatCurrency(cat.amount, locale);
      text += `${icon} ${cat.categoryName}: ${amount}\n`;
    });
    text += `\n`;
  }

  // Budget Insights
  const hasOverBudget = budgets.overBudget.length > 0;
  const hasCritical = budgets.critical.length > 0;
  const hasMonthly = budgets.monthlyOverview !== null;

  if (hasOverBudget || hasCritical || hasMonthly) {
    text += `${t('emails.digest.budgetInsights')}\n${'='.repeat(40)}\n\n`;

    // Over budget
    budgets.overBudget.forEach(cat => {
      const over = formatCurrency(cat.overAmount, locale);
      text += `⚠️ ${t('emails.digest.overBudget', { category: cat.category, amount: over })}\n`;
    });

    // Critical
    budgets.critical.forEach(cat => {
      const remaining = formatCurrency(cat.remaining, locale);
      const percent = Math.round(cat.percentage);
      text += `📢 ${t('emails.digest.criticalWarning', { category: cat.category, percent, remaining })}\n`;
    });

    // Healthy summary
    if (budgets.healthyCount > 0) {
      text += `✓ ${t('emails.digest.healthySummary', { count: budgets.healthyCount })}\n`;
    }

    // Monthly overview
    if (hasMonthly) {
      const spent = formatCurrency(budgets.monthlyOverview!.spent, locale);
      const budget = formatCurrency(budgets.monthlyOverview!.budget, locale);
      const percent = Math.round(budgets.monthlyOverview!.percentage);
      text += `\n${t('emails.digest.monthlyOverview', { spent, budget, percent })}\n`;
    }

    text += `\n`;
  }

  text += `\n${t('emails.digest.viewBudgetsText')} ${appUrl}/budgets\n`;
  text += `\n${t('emails.digest.footer')}`;

  return text;
}
