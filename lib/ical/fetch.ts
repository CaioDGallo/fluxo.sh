import type { FetchResult } from './types';
import { logError, logForDebugging } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB

export async function fetchICalUrl(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/calendar, application/calendar+json, */*',
        'User-Agent': 'Northstar-Calendar-Sync/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logForDebugging('ical:fetch', `HTTP ${response.status} for ${url}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check content length before reading body
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        error: `Content too large: ${contentLength} bytes exceeds ${MAX_CONTENT_LENGTH} limit`,
      };
    }

    // Read as text with size check
    const text = await response.text();
    if (text.length > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        error: `Content too large: ${text.length} bytes`,
      };
    }

    // Basic iCal validation
    if (!text.includes('BEGIN:VCALENDAR')) {
      return {
        success: false,
        error: 'Invalid iCal format: missing VCALENDAR',
      };
    }

    return {
      success: true,
      data: text,
      headers: {
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
      } as Record<string, string>,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: `Request timed out after ${FETCH_TIMEOUT_MS}ms` };
    }

    logError(ErrorIds.CALENDAR_SYNC_FETCH_FAILED, 'iCal fetch failed', error, { url });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  }
}

/**
 * Fetch with retry logic
 */
export async function fetchICalUrlWithRetry(
  url: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<FetchResult> {
  let lastResult: FetchResult = { success: false, error: 'No attempts made' };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResult = await fetchICalUrl(url);

    if (lastResult.success) {
      return lastResult;
    }

    // Don't retry on client errors (4xx) or content issues
    if (lastResult.error?.includes('HTTP 4') || lastResult.error?.includes('Invalid iCal')) {
      break;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  return lastResult;
}
