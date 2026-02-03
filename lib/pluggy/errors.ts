export type PluggyErrorCode =
  | 'PLUGGY_AUTH_FAILED'      // 401
  | 'PLUGGY_RATE_LIMITED'     // 429
  | 'PLUGGY_ITEM_NOT_FOUND'   // 404
  | 'PLUGGY_TIMEOUT'          // AbortError
  | 'PLUGGY_CONSENT_EXPIRED'  // message contains "consent"
  | 'PLUGGY_CONNECTION_ERROR' // network failures
  | 'PLUGGY_UNKNOWN';

export class PluggyError extends Error {
  constructor(
    public code: PluggyErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'PluggyError';
  }
}

export function mapToPluggyError(error: unknown, statusCode?: number): PluggyError {
  // Already a PluggyError
  if (error instanceof PluggyError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Timeout
  if (error instanceof Error && error.name === 'AbortError') {
    return new PluggyError('PLUGGY_TIMEOUT', 'Request timed out', undefined, error);
  }

  // Connection errors
  if (
    error instanceof Error &&
    ('cause' in error || lowerMessage.includes('fetch') || lowerMessage.includes('network'))
  ) {
    return new PluggyError('PLUGGY_CONNECTION_ERROR', message, statusCode, error);
  }

  // HTTP status-based mapping
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return new PluggyError('PLUGGY_AUTH_FAILED', message, statusCode, error);
      case 404:
        return new PluggyError('PLUGGY_ITEM_NOT_FOUND', message, statusCode, error);
      case 429:
        return new PluggyError('PLUGGY_RATE_LIMITED', message, statusCode, error);
    }
  }

  // Message-based detection
  if (lowerMessage.includes('consent') && lowerMessage.includes('expir')) {
    return new PluggyError('PLUGGY_CONSENT_EXPIRED', message, statusCode, error);
  }

  // Default
  return new PluggyError('PLUGGY_UNKNOWN', message, statusCode, error);
}
