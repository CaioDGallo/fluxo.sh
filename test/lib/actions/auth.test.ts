import { describe, it, expect, beforeEach, vi } from 'vitest';

type AuthActions = typeof import('@/lib/actions/auth');

describe('Auth Actions', () => {
  const signInWithPassword = vi.fn();
  const resetPasswordForEmail = vi.fn();
  const updateUser = vi.fn();
  const signOut = vi.fn();
  const getUser = vi.fn();

  const createClientMock = vi.fn(async () => ({
    auth: {
      signInWithPassword,
      resetPasswordForEmail,
      updateUser,
      signOut,
      getUser,
    },
  }));

  const checkLoginRateLimitMock = vi.fn();
  const checkPasswordResetRateLimitMock = vi.fn();

  const tMock = vi.fn(async (key: string, params?: Record<string, string | number>) => {
    if (params && 'retryAfter' in params) {
      return `${key}:${params.retryAfter}`;
    }
    return key;
  });

  const redirectMock = vi.fn();

  const loadActions = async (): Promise<AuthActions> => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
    vi.doMock('@/lib/rate-limit', () => ({
      checkLoginRateLimit: checkLoginRateLimitMock,
      checkPasswordResetRateLimit: checkPasswordResetRateLimitMock,
    }));
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));

    return await import('@/lib/actions/auth');
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    delete process.env.E2E_AUTH_BYPASS;

    checkLoginRateLimitMock.mockResolvedValue({ allowed: true });
    checkPasswordResetRateLimitMock.mockResolvedValue({ allowed: true });

    signInWithPassword.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'user' } } });
  });

  it('login returns translated error when rate limit denied', async () => {
    checkLoginRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const { login } = await loadActions();
    const result = await login('user@example.com', 'pass', 'captcha');

    expect(result).toEqual({ error: 'errors.tooManyAttempts:30' });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('login returns authenticationFailed on Supabase error', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid' } });

    const { login } = await loadActions();
    const result = await login('user@example.com', 'pass', 'captcha');

    expect(result).toEqual({ error: 'login.authenticationFailed' });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'pass',
      options: { captchaToken: 'captcha' },
    });
  });

  it('login succeeds when Supabase returns success', async () => {
    const { login } = await loadActions();
    const result = await login('user@example.com', 'pass', 'captcha');

    expect(result).toEqual({ error: null });
  });

  it('forgotPassword returns translated error when rate limit denied', async () => {
    checkPasswordResetRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 15 });

    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: 'errors.tooManyAttempts:15' });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('forgotPassword returns success even on Supabase error', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'failed' } });

    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: null });
    expect(console.error).toHaveBeenCalled();
  });

  it('forgotPassword returns success when Supabase succeeds', async () => {
    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: null });
  });

  it('updatePassword returns notAuthenticated when user missing', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: 'errors.notAuthenticated' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updatePassword validates minimum length', async () => {
    const { updatePassword } = await loadActions();
    const result = await updatePassword('Short1');

    expect(result).toEqual({ error: 'errors.passwordTooShort' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updatePassword validates letter and number requirements', async () => {
    const { updatePassword } = await loadActions();
    const result = await updatePassword('12345678');

    expect(result).toEqual({ error: 'errors.passwordRequirementsNotMet' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updatePassword returns unexpectedError on Supabase failure', async () => {
    updateUser.mockResolvedValue({ error: { message: 'failed' } });

    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: 'errors.unexpectedError' });
  });

  it('updatePassword returns success on valid password', async () => {
    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: null });
    expect(updateUser).toHaveBeenCalledWith({ password: 'Password123' });
  });

  it('logout signs out and redirects', async () => {
    const { logout } = await loadActions();

    await logout();

    expect(signOut).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
