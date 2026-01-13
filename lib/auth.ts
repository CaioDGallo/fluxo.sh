import { createClient } from '@/lib/supabase/server';

/**
 * Gets the currently authenticated user's ID from Supabase Auth.
 * @throws {Error} If no user is authenticated
 * @returns The user's UUID
 */
export async function getCurrentUserId(): Promise<string> {
  if (process.env.E2E_AUTH_BYPASS === 'true' && process.env.E2E_AUTH_USER_ID) {
    return process.env.E2E_AUTH_USER_ID;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user.id;
}
