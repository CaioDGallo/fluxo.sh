import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logError, logEvent, logForDebugging, logWarning } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;
  const setNodeEnv = (value?: string) => {
    const env = process.env as Record<string, string | undefined>;
    if (value === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = value;
    }
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setNodeEnv(originalEnv);
    vi.restoreAllMocks();
  });

  it('logs error details with context', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Boom');

    logError(ErrorIds.DB_WRITE_FAILED, 'Failed to save record', error, { recordId: 123 });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const errorData = consoleError.mock.calls[0][4] as {
      errorId: string;
      message: string;
      timestamp: string;
      context: Record<string, unknown>;
      error: { message: string; name: string };
    };

    expect(errorData.errorId).toBe(ErrorIds.DB_WRITE_FAILED);
    expect(errorData.message).toBe('Failed to save record');
    expect(errorData.context).toEqual({ recordId: 123 });
    expect(errorData.error.message).toBe('Boom');
    expect(new Date(errorData.timestamp).toISOString()).toBe(errorData.timestamp);
  });

  it('logs debug output only in development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    setNodeEnv('development');

    logForDebugging('budgets:get', 'Fetching budgets', { userId: 'abc' });

    expect(consoleLog).toHaveBeenCalledWith('[DEBUG] [budgets:get]', 'Fetching budgets', { userId: 'abc' });
  });

  it('suppresses debug output outside development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    setNodeEnv('production');

    logForDebugging('budgets:get', 'Fetching budgets', { userId: 'abc' });

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('logs analytics events only in development', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    setNodeEnv('development');

    logEvent('budget_created', { budgetType: 'monthly' });

    expect(consoleLog).toHaveBeenCalled();
    expect(consoleLog.mock.calls[0][0]).toBe('[ANALYTICS]');
  });

  it('always logs warnings', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logWarning('billing', 'Slow sync', { subscriptionId: 1 });

    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleWarn.mock.calls[0][0]).toContain('[WARN]');
  });
});
