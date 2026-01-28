import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('stripe-prices', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns price ids for saver monthly/yearly', async () => {
    process.env.STRIPE_PRICE_SAVER_MONTHLY = 'price_saver_monthly';
    process.env.STRIPE_PRICE_SAVER_YEARLY = 'price_saver_yearly';

    const { getStripePriceId } = await import('@/lib/billing/stripe-prices');

    expect(getStripePriceId('saver', 'monthly')).toBe('price_saver_monthly');
    expect(getStripePriceId('saver', 'yearly')).toBe('price_saver_yearly');
  });

  it('throws when a price is missing', async () => {
    process.env.STRIPE_PRICE_SAVER_MONTHLY = 'price_saver_monthly';
    delete process.env.STRIPE_PRICE_SAVER_YEARLY;

    const { getStripePriceId } = await import('@/lib/billing/stripe-prices');

    expect(() => getStripePriceId('saver', 'yearly')).toThrow(
      'Missing Stripe price for saver (yearly)'
    );
  });

  it('maps price ids back to plan and interval', async () => {
    process.env.STRIPE_PRICE_SAVER_MONTHLY = 'price_saver_monthly';
    process.env.STRIPE_PRICE_SAVER_YEARLY = 'price_saver_yearly';
    process.env.STRIPE_PRICE_FOUNDER_YEARLY = 'price_founder_yearly';

    const { getPlanFromStripePrice } = await import('@/lib/billing/stripe-prices');

    expect(getPlanFromStripePrice('price_saver_monthly')).toEqual({
      planKey: 'saver',
      interval: 'monthly',
    });
    expect(getPlanFromStripePrice('price_saver_yearly')).toEqual({
      planKey: 'saver',
      interval: 'yearly',
    });
    expect(getPlanFromStripePrice('price_founder_yearly')).toEqual({
      planKey: 'founder',
      interval: 'yearly',
    });
  });

  it('returns null for unknown prices', async () => {
    process.env.STRIPE_PRICE_SAVER_MONTHLY = 'price_saver_monthly';
    process.env.STRIPE_PRICE_SAVER_YEARLY = 'price_saver_yearly';

    const { getPlanFromStripePrice } = await import('@/lib/billing/stripe-prices');

    expect(getPlanFromStripePrice('price_unknown')).toBeNull();
  });
});
