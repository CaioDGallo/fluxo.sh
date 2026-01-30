import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { billingCustomers, billingSubscriptions } from '@/lib/schema';
import { users } from '@/lib/auth-schema';
import { getPlanFromStripePrice, type PaidPlanKey } from '@/lib/billing/stripe-prices';
import { sendBillingEmail, getUserLocale } from '@/lib/email/billing-emails';
import {
  generateSubscriptionPurchasedHtml,
  generateSubscriptionPurchasedText,
} from '@/lib/email/subscription-purchased-template';
import {
  generatePaymentFailedHtml,
  generatePaymentFailedText,
} from '@/lib/email/payment-failed-template';
import {
  generateSubscriptionCanceledHtml,
  generateSubscriptionCanceledText,
} from '@/lib/email/subscription-canceled-template';
import {
  generateSubscriptionEndedHtml,
  generateSubscriptionEndedText,
} from '@/lib/email/subscription-ended-template';
import {
  generatePaymentReceiptHtml,
  generatePaymentReceiptText,
} from '@/lib/email/payment-receipt-template';
import {
  generatePlanChangedHtml,
  generatePlanChangedText,
} from '@/lib/email/plan-changed-template';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

function getProductId(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): string | null {
  if (!product) return null;
  return typeof product === 'string' ? product : product.id;
}

function toDate(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

function formatDate(date: Date | null, locale: string = 'pt-BR'): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatAmount(amountCents: number, currency: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

async function upsertBillingCustomer(userId: string, stripeCustomerId: string) {
  await db
    .insert(billingCustomers)
    .values({
      userId,
      stripeCustomerId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingCustomers.userId,
      set: {
        stripeCustomerId,
        updatedAt: new Date(),
      },
    });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse('STRIPE_WEBHOOK_SECRET not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('Missing Stripe signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe] webhook signature failed', error);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const stripeCustomerId = getCustomerId(session.customer);

        if (userId && stripeCustomerId) {
          await upsertBillingCustomer(userId, stripeCustomerId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = getCustomerId(subscription.customer);
        const item = subscription.items.data[0];
        const stripePriceId = item?.price?.id || null;
        const stripeProductId = getProductId(item?.price?.product);
        const resolvedPlan = stripePriceId ? getPlanFromStripePrice(stripePriceId) : null;

        const planKey = (subscription.metadata?.planKey as PaidPlanKey | undefined) || resolvedPlan?.planKey;

        // Process all plans, not just 'pro'
        if (!planKey) {
          break;
        }

        let userId = subscription.metadata?.userId || null;
        if (!userId && stripeCustomerId) {
          const existingCustomer = await db.query.billingCustomers.findFirst({
            where: eq(billingCustomers.stripeCustomerId, stripeCustomerId),
          });
          userId = existingCustomer?.userId || null;
        }

        if (!userId || !stripeCustomerId) {
          break;
        }

        // Get existing subscription to detect changes
        const previousSubscription = await db.query.billingSubscriptions.findFirst({
          where: eq(billingSubscriptions.stripeSubscriptionId, subscription.id),
        });

        await upsertBillingCustomer(userId, stripeCustomerId);

        // Set founder status if purchasing founder plan
        if (planKey === 'founder') {
          await db.update(users).set({ isFounder: true }).where(eq(users.id, userId));
        }

        // Map founder to saver for entitlements (same features)
        const subscriptionPlanKey = planKey === 'founder' ? 'saver' : planKey;

        await db
          .insert(billingSubscriptions)
          .values({
            userId,
            planKey: subscriptionPlanKey,
            status: subscription.status,
            currentPeriodStart: toDate(item?.current_period_start),
            currentPeriodEnd: toDate(item?.current_period_end),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            stripeSubscriptionId: subscription.id,
            stripePriceId,
            stripeProductId,
            trialEndsAt: toDate(subscription.trial_end),
            endedAt: toDate(subscription.ended_at),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: billingSubscriptions.stripeSubscriptionId,
            set: {
              userId,
              planKey: subscriptionPlanKey,
              status: subscription.status,
              currentPeriodStart: toDate(item?.current_period_start),
              currentPeriodEnd: toDate(item?.current_period_end),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              stripePriceId,
              stripeProductId,
              trialEndsAt: toDate(subscription.trial_end),
              endedAt: toDate(subscription.ended_at),
              updatedAt: new Date(),
            },
          });

        // Send billing emails
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.email) break;

        const locale = await getUserLocale(userId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';
        const planName = PLANS[planKey].name;
        const interval = item?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly';
        const billingPeriod = interval === 'yearly' ? 'Anual' : 'Mensal';
        const currentPeriodEnd = toDate(item?.current_period_end);
        const nextBillingDate = currentPeriodEnd ? formatDate(currentPeriodEnd, locale) : '';

        // 1. Subscription Purchased (created event)
        if (event.type === 'customer.subscription.created' && subscription.status === 'active') {
          const amountDisplay = item?.price?.unit_amount
            ? formatAmount(item.price.unit_amount, item.price.currency.toUpperCase())
            : '';

          const html = generateSubscriptionPurchasedHtml({
            planName,
            billingPeriod,
            amountDisplay,
            nextBillingDate,
            appUrl,
            locale,
          });
          const text = generateSubscriptionPurchasedText({
            planName,
            billingPeriod,
            amountDisplay,
            nextBillingDate,
            appUrl,
            locale,
          });

          await sendBillingEmail({
            userId,
            userEmail: user.email,
            emailType: 'subscription_purchased',
            referenceId: subscription.id,
            subject:
              locale === 'pt-BR'
                ? `Assinatura ativada - ${planName}`
                : `Subscription activated - ${planName}`,
            html,
            text,
          });
        }

        // 2. Payment Failed (status changed to past_due)
        if (
          event.type === 'customer.subscription.updated' &&
          subscription.status === 'past_due' &&
          previousSubscription?.status !== 'past_due'
        ) {
          const gracePeriodDate = currentPeriodEnd
            ? formatDate(currentPeriodEnd, locale)
            : formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), locale);

          const html = generatePaymentFailedHtml({
            planName,
            gracePeriodDate,
            appUrl,
            locale,
          });
          const text = generatePaymentFailedText({
            planName,
            gracePeriodDate,
            appUrl,
            locale,
          });

          await sendBillingEmail({
            userId,
            userEmail: user.email,
            emailType: 'payment_failed',
            referenceId: subscription.id,
            subject:
              locale === 'pt-BR'
                ? 'Ação necessária: Falha no pagamento'
                : 'Action required: Payment failed',
            html,
            text,
          });
        }

        // 3. Subscription Canceled (cancelAtPeriodEnd became true)
        if (
          event.type === 'customer.subscription.updated' &&
          subscription.cancel_at_period_end &&
          !previousSubscription?.cancelAtPeriodEnd
        ) {
          const accessUntilDate = currentPeriodEnd ? formatDate(currentPeriodEnd, locale) : '';

          const html = generateSubscriptionCanceledHtml({
            planName,
            accessUntilDate,
            appUrl,
            locale,
          });
          const text = generateSubscriptionCanceledText({
            planName,
            accessUntilDate,
            appUrl,
            locale,
          });

          await sendBillingEmail({
            userId,
            userEmail: user.email,
            emailType: 'subscription_canceled',
            referenceId: subscription.id,
            subject: locale === 'pt-BR' ? 'Assinatura cancelada' : 'Subscription canceled',
            html,
            text,
          });
        }

        // 4. Subscription Ended (deleted event)
        if (event.type === 'customer.subscription.deleted') {
          const html = generateSubscriptionEndedHtml({
            planName,
            appUrl,
            locale,
          });
          const text = generateSubscriptionEndedText({
            planName,
            appUrl,
            locale,
          });

          await sendBillingEmail({
            userId,
            userEmail: user.email,
            emailType: 'subscription_ended',
            referenceId: subscription.id,
            subject:
              locale === 'pt-BR' ? 'Sua assinatura foi encerrada' : 'Your subscription has ended',
            html,
            text,
          });
        }

        // 5. Plan Changed (plan key changed)
        if (
          event.type === 'customer.subscription.updated' &&
          previousSubscription &&
          previousSubscription.planKey !== subscriptionPlanKey
        ) {
          const oldPlanName = PLANS[previousSubscription.planKey as keyof typeof PLANS].name;
          const newPlanName = PLANS[subscriptionPlanKey as keyof typeof PLANS].name;
          // Determine upgrade vs downgrade (simple heuristic: compare plan keys alphabetically)
          // In practice: pro > saver > free, but since subscriptionPlanKey excludes 'free', any change from 'free' is upgrade
          const isUpgrade = previousSubscription.planKey === 'free' || subscriptionPlanKey === 'pro';
          const effectiveDateObj = currentPeriodEnd || new Date();
          const effectiveDateStr = formatDate(effectiveDateObj, locale);

          const html = generatePlanChangedHtml({
            oldPlanName,
            newPlanName,
            isUpgrade,
            effectiveDate: effectiveDateStr,
            newLimits: PLANS[subscriptionPlanKey].limits,
            appUrl,
            locale,
          });
          const text = generatePlanChangedText({
            oldPlanName,
            newPlanName,
            isUpgrade,
            effectiveDate: effectiveDateStr,
            newLimits: PLANS[subscriptionPlanKey].limits,
            appUrl,
            locale,
          });

          await sendBillingEmail({
            userId,
            userEmail: user.email,
            emailType: 'plan_changed',
            referenceId: subscription.id,
            subject: locale === 'pt-BR' ? 'Plano atualizado' : 'Plan updated',
            html,
            text,
          });
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = getCustomerId(invoice.customer);

        if (!stripeCustomerId) break;

        // Get user from customer
        const existingCustomer = await db.query.billingCustomers.findFirst({
          where: eq(billingCustomers.stripeCustomerId, stripeCustomerId),
        });
        const userId = existingCustomer?.userId;

        if (!userId) break;

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user?.email) break;

        // Get subscription to determine plan
        // Using type assertion since subscription may be expanded or not
        const subscriptionField = (invoice as { subscription?: string | { id: string } })
          .subscription as
          | string
          | { id: string }
          | null
          | undefined;
        const subscriptionId =
          typeof subscriptionField === 'string' ? subscriptionField : subscriptionField?.id;
        if (!subscriptionId) break;

        const subscription = await db.query.billingSubscriptions.findFirst({
          where: eq(billingSubscriptions.stripeSubscriptionId, subscriptionId),
        });
        if (!subscription) break;

        const locale = await getUserLocale(userId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';
        const planName = PLANS[subscription.planKey as keyof typeof PLANS].name;
        const invoiceNumber = invoice.number || invoice.id.substring(3, 11);
        const date = formatDate(new Date(invoice.created * 1000), locale);
        const amountDisplay = formatAmount(invoice.amount_paid, invoice.currency.toUpperCase());
        const invoiceUrl = invoice.hosted_invoice_url || `${appUrl}/settings/billing`;

        const html = generatePaymentReceiptHtml({
          invoiceNumber,
          date,
          planName,
          amountDisplay,
          invoiceUrl,
          appUrl,
          locale,
        });
        const text = generatePaymentReceiptText({
          invoiceNumber,
          date,
          planName,
          amountDisplay,
          invoiceUrl,
          appUrl,
          locale,
        });

        await sendBillingEmail({
          userId,
          userEmail: user.email,
          emailType: 'payment_receipt',
          referenceId: invoice.id,
          subject:
            locale === 'pt-BR'
              ? `Recibo de pagamento - ${amountDisplay}`
              : `Payment receipt - ${amountDisplay}`,
          html,
          text,
        });

        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('[stripe] webhook handling failed', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return NextResponse.json({ received: true });
}
