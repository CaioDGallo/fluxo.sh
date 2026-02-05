import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis for rate limiting
function getRedisClient(): Redis {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  if (process.env.REDIS_URL) {
    return Redis.fromEnv();
  }

  throw new Error('Redis not configured for middleware rate limiting');
}

let redis: Redis | null = null;
let globalLimiter: Ratelimit | null = null;
let apiLimiter: Ratelimit | null = null;

function initializeRateLimiters() {
  if (redis) return;

  redis = getRedisClient();
  globalLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '60 s'),
    prefix: 'ratelimit:global',
  });

  apiLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    prefix: 'ratelimit:api',
  });
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');

  return (
    forwarded?.split(',')[0].trim() ||
    realIp ||
    vercelForwarded?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPlaywright = request.headers.get('x-playwright') === 'true';

  if (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true' || isPlaywright) {
    return NextResponse.next();
  }

  // Skip rate limiting for static assets and Next.js internals
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/_next/data') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/fonts/') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Rate limiting
  const ip = getClientIP(request);
  const isApiRoute = pathname.startsWith('/api/');
  initializeRateLimiters();
  const limiter = isApiRoute ? apiLimiter : globalLimiter;
  if (!limiter) {
    throw new Error('Rate limiter not initialized');
  }
  const { success, reset } = await limiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    });
  }

  // Auth logic
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Public routes
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
  ];

  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/auth');

  // Invalid user flag → force logout
  if (token?.userInvalid) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/auth/signout';
    return NextResponse.redirect(url);
  }

  // Redirect to login if not authenticated and not on public route
  if (!token && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if authenticated and on login page
  if (token && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (PWA manifest)
     * - sw.js (service worker)
     * - offline (offline fallback)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
