import { createClient } from '@/lib/supabase/server';

/**
 * Gets the currently authenticated user's ID from Supabase Auth.
 * @throws {Error} If no user is authenticated
 * @returns The user's UUID
 */
export async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user.id;
}
