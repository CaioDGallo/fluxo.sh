import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

// Initialize Redis client (supports both Upstash REST API and local Redis)
function getRedisClient(): Redis {
  // Production: Use Upstash REST API
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  // Development: Use local Redis (requires ioredis adapter)
  if (process.env.REDIS_URL) {
    return Redis.fromEnv();
  }

  throw new Error(
    'Redis not configured. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (production) or REDIS_URL (development)'
  );
}

// Lazy initialization to avoid errors during module load in tests
let redis: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let passwordResetLimiter: Ratelimit | null = null;
let passwordUpdateLimiter: Ratelimit | null = null;
let signupLimiter: Ratelimit | null = null;
let bulkLimiter: Ratelimit | null = null;
let crudLimiter: Ratelimit | null = null;
let destructiveLimiter: Ratelimit | null = null;
let pluggyConnectLimiter: Ratelimit | null = null;
let pluggyDisconnectLimiter: Ratelimit | null = null;
let pluggyManualSyncLimiter: Ratelimit | null = null;
let pluggyAutoSyncLimiter: Ratelimit | null = null;
let testPushLimiter: Ratelimit | null = null;

function initializeRateLimiters() {
  if (redis) return; // Already initialized

  redis = getRedisClient();

  loginLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '60 s'),
    prefix: 'ratelimit:login',
  });

  passwordResetLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '60 s'),
    prefix: 'ratelimit:password-reset',
  });

  passwordUpdateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix: 'ratelimit:password-update',
  });

  signupLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix: 'ratelimit:signup',
  });

  bulkLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'ratelimit:bulk',
  });

  crudLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'ratelimit:crud',
  });

  destructiveLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '3600 s'),
    prefix: 'ratelimit:destructive',
  });

  pluggyConnectLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '3600 s'),
    prefix: 'ratelimit:pluggy-connect',
  });

  pluggyDisconnectLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '3600 s'),
    prefix: 'ratelimit:pluggy-disconnect',
  });

  pluggyManualSyncLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, '86400 s'),
    prefix: 'ratelimit:pluggy-manual-sync',
  });

  pluggyAutoSyncLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, '86400 s'),
    prefix: 'ratelimit:pluggy-auto-sync',
  });

  testPushLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '3600 s'),
    prefix: 'ratelimit:test-push',
  });

}

export async function getClientIP(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    h.get('x-real-ip') ||
    h.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

async function checkLimit(
  getLimiter: () => Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  // Bypass rate limiting in test environment
  if (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true') {
    return { allowed: true };
  }

  // Initialize rate limiters if not already done
  initializeRateLimiters();

  const limiter = getLimiter();
  if (!limiter) {
    throw new Error('Rate limiter not initialized');
  }

  const { success, reset } = await limiter.limit(key);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  return { allowed: true };
}

// IP-based rate limiters
export async function checkLoginRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(() => loginLimiter, ip);
}

export async function checkPasswordResetRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(() => passwordResetLimiter, ip);
}

export async function checkPasswordUpdateRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(() => passwordUpdateLimiter, ip);
}

export async function checkSignupRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(() => signupLimiter, ip);
}

// User-based rate limiters
export async function checkBulkRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => bulkLimiter, userId);
}

export async function checkCrudRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => crudLimiter, userId);
}

export async function checkDestructiveRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => destructiveLimiter, userId);
}

export async function checkPluggyConnectRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => pluggyConnectLimiter, userId);
}

export async function checkPluggyDisconnectRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => pluggyDisconnectLimiter, userId);
}

export async function checkPluggyManualSyncRateLimit(
  userId: string,
  pluggyItemId: string
): Promise<RateLimitResult> {
  return checkLimit(() => pluggyManualSyncLimiter, `${userId}:${pluggyItemId}`);
}

export async function checkPluggyAutoSyncRateLimit(
  userId: string,
  pluggyItemId: string
): Promise<RateLimitResult> {
  return checkLimit(() => pluggyAutoSyncLimiter, `${userId}:${pluggyItemId}`);
}

export async function checkTestPushRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(() => testPushLimiter, userId);
}
