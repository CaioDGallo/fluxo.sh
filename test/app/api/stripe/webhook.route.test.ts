import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Mock fetch for email sending
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ id: 'test-email-id' }),
}) as typeof global.fetch;

let db: ReturnType<typeof getTestDb>;
let POST: typeof import('@/app/api/stripe/webhook/route').POST;

const constructEventMock = vi.fn();
const webhookSecret = 'whsec_test';

const makeRequest = (body = 'payload', signature?: string) =>
  new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  });

describe('POST /api/stripe/webhook', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    vi.resetModules();
    process.env.STRIPE_PRICE_SAVER_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_SAVER_YEARLY = 'price_yearly';
    process.env.STRIPE_PRICE_FOUNDER_YEARLY = 'price_founder_yearly';
    process.env.RESEND_API_KEY = 'test-api-key';

    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/stripe', () => ({
      stripe: {
        webhooks: {
          constructEvent: constructEventMock,
        },
      },
    }));

    ({ POST } = await import('@/app/api/stripe/webhook/route'));
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    constructEventMock.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  });

  it('returns 500 when webhook secret is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('STRIPE_WEBHOOK_SECRET not configured');
  });

  it('returns 400 when signature is missing', async () => {
    const response = await POST(makeRequest('payload'));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing Stripe signature');
  });

  it('returns 400 when signature validation fails', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid signature');
    expect(constructEventMock).toHaveBeenCalledWith('payload', 'sig', webhookSecret);
  });

  it('upserts billing customer on checkout.session.completed', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-123',
          customer: 'cus_123',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.userId).toBe('user-123');
    expect(customers[0]?.stripeCustomerId).toBe('cus_123');
  });

  it('uses metadata userId when client_reference_id is missing', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_456',
          metadata: { userId: 'user-456' },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(200);

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.userId).toBe('user-456');
    expect(customers[0]?.stripeCustomerId).toBe('cus_456');
  });

  it('ignores checkout sessions without userId', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_missing',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(0);
  });

  it('stores subscription details for saver plan', async () => {
    const periodStart = 1_700_000_000;
    const periodEnd = 1_702_592_000;

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          customer: 'cus_123',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-123', planKey: 'saver', planInterval: 'monthly' },
          items: {
            data: [
              {
                current_period_start: periodStart,
                current_period_end: periodEnd,
                price: {
                  id: 'price_monthly',
                  product: { id: 'prod_123' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.stripeCustomerId).toBe('cus_123');

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.userId).toBe('user-123');
    expect(subscriptions[0]?.planKey).toBe('saver');
    expect(subscriptions[0]?.status).toBe('active');
    expect(subscriptions[0]?.stripeSubscriptionId).toBe('sub_123');
    expect(subscriptions[0]?.stripePriceId).toBe('price_monthly');
    expect(subscriptions[0]?.stripeProductId).toBe('prod_123');
    expect(new Date(subscriptions[0]?.currentPeriodStart ?? 0).getTime()).toBe(periodStart * 1000);
    expect(new Date(subscriptions[0]?.currentPeriodEnd ?? 0).getTime()).toBe(periodEnd * 1000);
  });

  it('resolves userId from existing billing customer and price mapping', async () => {
    await db.insert(schema.billingCustomers).values({
      userId: 'user-999',
      stripeCustomerId: 'cus_999',
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_999',
          status: 'past_due',
          customer: 'cus_999',
          cancel_at_period_end: true,
          trial_end: null,
          ended_at: null,
          metadata: {},
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_999',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db
      .select()
      .from(schema.billingSubscriptions)
      .where(eq(schema.billingSubscriptions.stripeSubscriptionId, 'sub_999'));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.userId).toBe('user-999');
    expect(subscriptions[0]?.planKey).toBe('saver');
    expect(subscriptions[0]?.stripeProductId).toBe('prod_999');
  });

  it('updates existing subscriptions on repeat events', async () => {
    constructEventMock
      .mockReturnValueOnce({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_repeat',
            status: 'active',
            customer: 'cus_repeat',
            cancel_at_period_end: false,
            trial_end: null,
            ended_at: null,
            metadata: { userId: 'user-repeat', planKey: 'saver' },
            items: {
              data: [
                {
                  current_period_start: 1_700_000_000,
                  current_period_end: 1_702_592_000,
                  price: {
                    id: 'price_monthly',
                    product: 'prod_repeat',
                  },
                },
              ],
            },
          },
        },
      })
      .mockReturnValueOnce({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_repeat',
            status: 'past_due',
            customer: 'cus_repeat',
            cancel_at_period_end: true,
            trial_end: null,
            ended_at: null,
            metadata: { userId: 'user-repeat', planKey: 'saver' },
            items: {
              data: [
                {
                  current_period_start: 1_700_000_000,
                  current_period_end: 1_702_592_000,
                  price: {
                    id: 'price_monthly',
                    product: 'prod_repeat',
                  },
                },
              ],
            },
          },
        },
      });

    await POST(makeRequest('payload', 'sig'));
    await POST(makeRequest('payload', 'sig'));

    const subscriptions = await db
      .select()
      .from(schema.billingSubscriptions)
      .where(eq(schema.billingSubscriptions.stripeSubscriptionId, 'sub_repeat'));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.status).toBe('past_due');
    expect(subscriptions[0]?.cancelAtPeriodEnd).toBe(true);
  });

  it('skips subscriptions without a matching plan', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_404',
          status: 'active',
          customer: 'cus_404',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: {},
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_unknown',
                  product: 'prod_404',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(0);
  });

  it('stores founder subscriptions as saver plan', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_founder',
          status: 'active',
          customer: 'cus_founder',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-founder', planKey: 'founder' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_founder_yearly',
                  product: 'prod_founder',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.planKey).toBe('saver');
    expect(subscriptions[0]?.stripePriceId).toBe('price_founder_yearly');
  });

  it('returns 500 when handler throws', async () => {
    const insertSpy = vi.spyOn(db, 'insert').mockImplementation(() => {
      throw new Error('boom');
    });

    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-500',
          customer: 'cus_500',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Checkout session handler failed');

    insertSpy.mockRestore();
  });

  it('sends subscription_purchased email on subscription.created', async () => {
    await db.insert(schema.users).values({
      id: 'user-email-test',
      email: 'test-email@example.com',
      passwordHash: 'test-hash',
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_email_test',
          status: 'active',
          customer: 'cus_email_test',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-email-test', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_email_test',
                  unit_amount: 2990,
                  currency: 'brl',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db.select().from(schema.sentEmails);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.userId).toBe('user-email-test');
    expect(sentEmails[0]?.emailType).toBe('subscription_purchased');
    expect(sentEmails[0]?.referenceId).toBe('sub_email_test');
  });

  it('sends payment_failed email when subscription becomes past_due', async () => {
    await db.insert(schema.users).values({
      id: 'user-past-due',
      email: 'test-pastdue@example.com',
      passwordHash: 'test-hash',
    });

    await db.insert(schema.billingSubscriptions).values({
      userId: 'user-past-due',
      planKey: 'saver',
      status: 'active',
      stripeSubscriptionId: 'sub_past_due',
      stripePriceId: 'price_monthly',
      stripeProductId: 'prod_test',
      currentPeriodStart: new Date(1_700_000_000 * 1000),
      currentPeriodEnd: new Date(1_702_592_000 * 1000),
      cancelAtPeriodEnd: false,
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_past_due',
          status: 'past_due',
          customer: 'cus_past_due',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-past-due', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_test',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_past_due'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.emailType).toBe('payment_failed');
  });

  it('sends subscription_canceled email when cancelAtPeriodEnd becomes true', async () => {
    await db.insert(schema.users).values({
      id: 'user-cancel',
      email: 'test-cancel@example.com',
      passwordHash: 'test-hash',
    });

    await db.insert(schema.billingSubscriptions).values({
      userId: 'user-cancel',
      planKey: 'saver',
      status: 'active',
      stripeSubscriptionId: 'sub_cancel',
      stripePriceId: 'price_monthly',
      stripeProductId: 'prod_test',
      currentPeriodStart: new Date(1_700_000_000 * 1000),
      currentPeriodEnd: new Date(1_702_592_000 * 1000),
      cancelAtPeriodEnd: false,
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_cancel',
          status: 'active',
          customer: 'cus_cancel',
          cancel_at_period_end: true,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-cancel', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_test',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_cancel'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.emailType).toBe('subscription_canceled');
  });

  it('sends subscription_ended email on subscription.deleted', async () => {
    await db.insert(schema.users).values({
      id: 'user-ended',
      email: 'test-ended@example.com',
      passwordHash: 'test-hash',
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_ended',
          status: 'canceled',
          customer: 'cus_ended',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: 1_702_592_000,
          metadata: { userId: 'user-ended', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_ended',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_ended'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.emailType).toBe('subscription_ended');
  });

  it('sends plan_changed email when plan changes', async () => {
    await db.insert(schema.users).values({
      id: 'user-plan-change',
      email: 'test-planchange@example.com',
      passwordHash: 'test-hash',
    });

    await db.insert(schema.billingSubscriptions).values({
      userId: 'user-plan-change',
      planKey: 'saver',
      status: 'active',
      stripeSubscriptionId: 'sub_plan_change',
      stripePriceId: 'price_monthly',
      stripeProductId: 'prod_test',
      currentPeriodStart: new Date(1_700_000_000 * 1000),
      currentPeriodEnd: new Date(1_702_592_000 * 1000),
      cancelAtPeriodEnd: false,
    });

    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_plan_change',
          status: 'active',
          customer: 'cus_plan_change',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-plan-change', planKey: 'pro' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_pro_monthly',
                  product: 'prod_pro',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_plan_change'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.emailType).toBe('plan_changed');
  });

  it('sends payment_receipt email on invoice.paid', async () => {
    await db.insert(schema.users).values({
      id: 'user-invoice',
      email: 'test-invoice@example.com',
      passwordHash: 'test-hash',
    });
    await db.insert(schema.billingCustomers).values({
      userId: 'user-invoice',
      stripeCustomerId: 'cus_invoice',
    });
    await db.insert(schema.billingSubscriptions).values({
      userId: 'user-invoice',
      planKey: 'saver',
      status: 'active',
      stripeSubscriptionId: 'sub_invoice',
      stripePriceId: 'price_monthly',
      stripeProductId: 'prod_test',
      currentPeriodStart: new Date(1_700_000_000 * 1000),
      currentPeriodEnd: new Date(1_702_592_000 * 1000),
      cancelAtPeriodEnd: false,
    });

    constructEventMock.mockReturnValue({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'inv_test',
          number: 'INV-001',
          customer: 'cus_invoice',
          subscription: 'sub_invoice',
          amount_paid: 2990,
          currency: 'brl',
          created: 1_700_000_000,
          hosted_invoice_url: 'https://invoice.stripe.com/inv_test',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'inv_test'));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.emailType).toBe('payment_receipt');
  });

  it('skips email when user has no email address', async () => {
    // Can't actually create a user with null email due to NOT NULL constraint
    // Instead, test the webhook code's handling when user email is missing from DB
    // by not creating a user at all
    // await db.insert(schema.users).values({
    //   id: 'user-no-email',
    //   email: null,
    //   passwordHash: 'test-hash',
    // });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_no_email',
          status: 'active',
          customer: 'cus_no_email',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-no-email', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_test',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    // Should not send email for this specific subscriptionId
    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_no_email'));
    expect(sentEmails).toHaveLength(0);
  });

  it('continues webhook processing when email send fails', async () => {
    // Mock fetch to fail once
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Resend API error' }),
    } as Response);

    await db.insert(schema.users).values({
      id: 'user-email-fail',
      email: 'test-fail@example.com',
      passwordHash: 'test-hash',
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_email_fail',
          status: 'active',
          customer: 'cus_email_fail',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-email-fail', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_fail',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db
      .select()
      .from(schema.billingSubscriptions)
      .where(eq(schema.billingSubscriptions.stripeSubscriptionId, 'sub_email_fail'));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.stripeSubscriptionId).toBe('sub_email_fail');

    // No email should be recorded for this specific subscription (since it failed)
    const sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_email_fail'));
    expect(sentEmails).toHaveLength(0);

    // Reset mock for other tests
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-email-id' }),
    } as Response);
  });

  it('deduplicates emails on webhook retry', async () => {
    await db.insert(schema.users).values({
      id: 'user-retry',
      email: 'test-retry@example.com',
      passwordHash: 'test-hash',
    });

    const eventPayload = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_retry',
          status: 'active',
          customer: 'cus_retry',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-retry', planKey: 'saver' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_retry',
                  recurring: { interval: 'month' },
                },
              },
            ],
          },
        },
      },
    };

    constructEventMock.mockReturnValue(eventPayload);

    await POST(makeRequest('payload', 'sig'));
    let sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_retry'));
    expect(sentEmails).toHaveLength(1);

    await POST(makeRequest('payload', 'sig'));
    sentEmails = await db
      .select()
      .from(schema.sentEmails)
      .where(eq(schema.sentEmails.referenceId, 'sub_retry'));
    expect(sentEmails).toHaveLength(1);
  });
});
