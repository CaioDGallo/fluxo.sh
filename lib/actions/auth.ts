'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { checkLoginRateLimit, checkPasswordResetRateLimit } from '@/lib/rate-limit';

export async function login(email: string, password: string, captchaToken: string) {
  const rateLimit = await checkLoginRateLimit();
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfter}s.` };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: {
      captchaToken,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function forgotPassword(email: string) {
  const rateLimit = await checkPasswordResetRateLimit();
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfter}s.` };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  // Always return success to prevent email enumeration
  if (error) {
    console.error('Password reset error:', error.message);
  }

  return { error: null };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Validate password requirements (8+ chars, letters + numbers)
  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { error: 'Password must contain letters and numbers' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
