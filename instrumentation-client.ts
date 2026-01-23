import posthog from 'posthog-js';

if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2025-11-30',
    capture_exceptions: true,
    capture_performance: false,
    debug: process.env.NODE_ENV === 'development',
  });
}
