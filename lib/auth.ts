import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';

/**
 * Gets the currently authenticated user's ID.
 * @throws {Error} If no user is authenticated (throws 'Unauthorized')
 * @returns The user's ID
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authConfig);

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

export { authConfig };
