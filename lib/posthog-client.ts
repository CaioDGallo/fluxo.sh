'use client';

type PosthogProperties = Record<string, unknown> | object;
type PosthogOptions = Record<string, unknown> | object;

type PosthogModule = typeof import('posthog-js');

let posthogModulePromise: Promise<PosthogModule> | null = null;
let initialized = false;

async function loadPosthog() {
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js');
  }

  const posthogModule = await posthogModulePromise;
  const posthog = posthogModule.default;

  const isLoaded = (posthog as { __loaded?: boolean }).__loaded;

  if (isLoaded) {
    initialized = true;
    return posthog;
  }

  if (!initialized) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!key || !host) {
      return null;
    }

    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
    });
    initialized = true;
  }

  return posthog;
}

export async function captureEvent(
  event: string,
  properties?: PosthogProperties,
  options?: PosthogOptions
) {
  const posthog = await loadPosthog();
  if (!posthog) return;
  posthog.capture(event, properties, options);
}

export async function identifyUser(
  distinctId: string,
  properties?: PosthogProperties
) {
  const posthog = await loadPosthog();
  if (!posthog) return;
  posthog.identify(distinctId, properties);
}
