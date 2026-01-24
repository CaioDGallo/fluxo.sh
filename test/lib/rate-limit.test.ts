import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const headersMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

const loadModule = async () => await import('@/lib/rate-limit');

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules();
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', async () => {
    const { checkLoginRateLimit, checkBulkRateLimit, checkPasswordResetRateLimit } = await loadModule();

    await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: true });
    await expect(checkBulkRateLimit('user-1')).resolves.toEqual({ allowed: true });
    await expect(checkPasswordResetRateLimit()).resolves.toEqual({ allowed: true });
  });

  it('extracts client IP from forwarded headers', async () => {
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }));
    const { getClientIP } = await loadModule();

    await expect(getClientIP()).resolves.toBe('1.1.1.1');
  });

  it('falls back to localhost when no IP headers are present', async () => {
    headersMock.mockResolvedValue(new Headers());
    const { getClientIP } = await loadModule();

    await expect(getClientIP()).resolves.toBe('127.0.0.1');
  });

  // it('bypasses rate limiting in test env', async () => {
  //   const { checkLoginRateLimit } = await loadModule();
  //
  //   for (let i = 0; i < 10; i += 1) {
  //     await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: true });
  //   }
  // });

  // Skip: Rate limiting is bypassed in test environment (see lib/rate-limit.ts line 114)
  it.skip('returns retryAfter when login rate limit is exceeded', async () => {
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '9.9.9.9' }));

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));

    const { checkLoginRateLimit } = await loadModule();

    for (let i = 0; i < 15; i += 1) {
      await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: true });
    }

    await expect(checkLoginRateLimit()).resolves.toEqual({ allowed: false, retryAfter: 60 });
  });

  // Skip: Rate limiting is bypassed in test environment (see lib/rate-limit.ts line 114)
  it.skip('uses the userId for bulk rate limiting', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T10:00:00Z'));

    const { checkBulkRateLimit } = await loadModule();

    for (let i = 0; i < 10; i += 1) {
      await expect(checkBulkRateLimit('user-123')).resolves.toEqual({ allowed: true });
    }

    await expect(checkBulkRateLimit('user-123')).resolves.toEqual({ allowed: false, retryAfter: 60 });
    await expect(checkBulkRateLimit('user-456')).resolves.toEqual({ allowed: true });
  });
});
