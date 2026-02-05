'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { setupNewUser } from '@/lib/user-setup/setup-new-user';
import { checkSignupRateLimit } from '@/lib/rate-limit';

export type SignupResult =
  | { success: true; userId: string }
  | { success: false; error: string };

/**
 * Creates a new user account with email/password
 */
export async function signup(data: {
  email: string;
  password: string;
  name: string;
  captchaToken: string;
}): Promise<SignupResult> {
  const { email, password, name, captchaToken } = data;

  // Check rate limit
  const rateLimit = await checkSignupRateLimit();
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Muitas tentativas. Tente novamente em ${rateLimit.retryAfter}s.`,
    };
  }

  // Validate CAPTCHA
  const captchaValid = await verifyCaptcha(captchaToken);
  if (!captchaValid) {
    return { success: false, error: 'Falha na verificação do captcha' };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    return { success: false, error: 'E-mail já cadastrado' };
  }

  // Validate password strength
  if (password.length < 8) {
    return { success: false, error: 'Senha deve ter no mínimo 8 caracteres' };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, error: 'Senha deve conter letras e números' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      name,
      passwordHash,
      emailVerified: null, // Skip email verification for now
    });

    // Setup default accounts and categories
    await setupNewUser(userId);

    return { success: true, userId };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Erro ao criar conta. Tente novamente.' };
  }
}

/**
 * Verifies Cloudflare Turnstile CAPTCHA token
 */
async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return false;
  }
}
