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

const redis = getRedisClient();

// Rate limiter instances with sliding window algorithm
const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '60 s'),
  prefix: 'ratelimit:login',
});

const passwordResetLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '60 s'),
  prefix: 'ratelimit:password-reset',
});

const passwordUpdateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ratelimit:password-update',
});

const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ratelimit:signup',
});

const waitlistLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '60 s'),
  prefix: 'ratelimit:waitlist',
});

const bulkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'ratelimit:bulk',
});

const crudLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '60 s'),
  prefix: 'ratelimit:crud',
});

const destructiveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '3600 s'),
  prefix: 'ratelimit:destructive',
});

const calendarSyncLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'ratelimit:calendar-sync',
});

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

async function checkLimit(limiter: Ratelimit, key: string): Promise<RateLimitResult> {
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
  return checkLimit(loginLimiter, ip);
}

export async function checkPasswordResetRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(passwordResetLimiter, ip);
}

export async function checkPasswordUpdateRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(passwordUpdateLimiter, ip);
}

export async function checkSignupRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(signupLimiter, ip);
}

export async function checkWaitlistRateLimit(): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkLimit(waitlistLimiter, ip);
}

// User-based rate limiters
export async function checkBulkRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(bulkLimiter, userId);
}

export async function checkCrudRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(crudLimiter, userId);
}

export async function checkDestructiveRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(destructiveLimiter, userId);
}

export async function checkCalendarSyncRateLimit(userId: string): Promise<RateLimitResult> {
  return checkLimit(calendarSyncLimiter, userId);
}
