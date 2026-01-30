import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';

export interface PaymentReceiptEmailData {
  invoiceNumber: string;
  date: string; // formatted date
  planName: string;
  amountDisplay: string; // 'R$ 29,90'
  invoiceUrl: string; // Stripe invoice URL
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

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generatePaymentReceiptHtml(data: PaymentReceiptEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.paymentReceipt.title');
  const greeting = t('emails.paymentReceipt.greeting');
  const intro = t('emails.paymentReceipt.intro');
  const invoiceLabel = t('emails.paymentReceipt.invoiceLabel');
  const dateLabel = t('emails.paymentReceipt.dateLabel');
  const planLabel = t('emails.paymentReceipt.planLabel');
  const amountLabel = t('emails.paymentReceipt.amountLabel');
  const viewInvoice = t('emails.paymentReceipt.viewInvoice');
  const footerText = t('emails.paymentReceipt.footer');

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
    <div style="border-bottom: 2px solid ${COLORS.success}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0; color: ${COLORS.success}; font-size: 24px; font-weight: 700;">${escapeHtml(title)}</h1>
    </div>

    <!-- Receipt Message -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 20px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(greeting)}</h2>
      <p style="margin: 0 0 20px 0; color: ${COLORS.fg}; line-height: 1.6;">${escapeHtml(intro)}</p>

      <!-- Receipt Details -->
      <div style="background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(invoiceLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right; font-family: monospace;">#${escapeHtml(data.invoiceNumber)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(dateLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">${escapeHtml(data.date)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(planLabel)}</td>
            <td style="padding: 8px 0; color: ${COLORS.fg}; font-weight: 500; text-align: right;">${escapeHtml(data.planName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-top: 1px solid ${COLORS.border}; color: ${COLORS.muted}; font-size: 12px;">${escapeHtml(amountLabel)}</td>
            <td style="padding: 8px 0; border-top: 1px solid ${COLORS.border}; color: ${COLORS.success}; font-weight: 700; text-align: right; font-size: 16px;">${escapeHtml(data.amountDisplay)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CTA Buttons -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.invoiceUrl}" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg}; margin-right: 8px;">
        ${escapeHtml(viewInvoice)}
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

export function generatePaymentReceiptText(data: PaymentReceiptEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.paymentReceipt.title');
  const greeting = t('emails.paymentReceipt.greeting');
  const intro = t('emails.paymentReceipt.intro');
  const invoiceLabel = t('emails.paymentReceipt.invoiceLabel');
  const dateLabel = t('emails.paymentReceipt.dateLabel');
  const planLabel = t('emails.paymentReceipt.planLabel');
  const amountLabel = t('emails.paymentReceipt.amountLabel');
  const viewInvoice = t('emails.paymentReceipt.viewInvoice');
  const footerText = t('emails.paymentReceipt.footer');

  return `
${title}

${greeting}

${intro}

${invoiceLabel}: #${data.invoiceNumber}
${dateLabel}: ${data.date}
${planLabel}: ${data.planName}
${amountLabel}: ${data.amountDisplay}

${viewInvoice}: ${data.invoiceUrl}

---
${footerText}
  `.trim();
}
