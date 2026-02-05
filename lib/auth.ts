import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';
import { cache } from 'react';
import { redirect } from 'next/navigation';

/**
 * Cached per-request session with validation.
 * Returns null if session is invalid or user doesn't exist.
 */
export const getValidatedSession = cache(async () => {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) return null;
  if ('error' in session && session.error === 'UserNotFound') return null;

  return session;
});

/**
 * Gets the currently authenticated user's ID.
 * @throws {Error} If no user is authenticated (throws 'Unauthorized')
 * @returns The user's ID
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await getValidatedSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
}

/**
 * Gets the current session (null if not authenticated)
 */
export async function getSession() {
  return await getServerSession(authConfig);
}

/**
 * Requires a valid session, redirecting to login if invalid.
 * Use this in layouts and pages for auth enforcement.
 */
export async function requireValidSession() {
  const session = await getValidatedSession();
  if (!session?.user?.id) {
    redirect('/login?error=session_expired');
  }
  return session;
}

export { authConfig };
