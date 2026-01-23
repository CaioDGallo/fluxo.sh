'use server';

import { db } from '@/lib/db';
import { waitlist } from '@/lib/auth-schema';
import { checkWaitlistRateLimit } from '@/lib/rate-limit';
import { getPostHogClient } from '@/lib/posthog-server';
import { eq } from 'drizzle-orm';

export type JoinWaitlistInput = {
  email: string;
  metadata?: Record<string, unknown>;
};

export type JoinWaitlistResult =
  | { success: true }
  | {
      success: false;
      error: string;
      code: 'RATE_LIMITED' | 'DUPLICATE' | 'INVALID_EMAIL' | 'ERROR';
    };

/**
 * Joins the waitlist
 * - Rate limited: 3 attempts per minute per IP
 * - Validates email format
 * - Checks for duplicates
 * - Tracks event in PostHog
 */
export async function joinWaitlist(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
  // 1. Rate limit check
  const rateLimitResult = await checkWaitlistRateLimit();
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: 'Muitas tentativas. Aguarde um momento.',
      code: 'RATE_LIMITED',
    };
  }

  // 2. Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    return {
      success: false,
      error: 'Por favor, insira um e-mail válido.',
      code: 'INVALID_EMAIL',
    };
  }

  // 3. Duplicate check
  try {
    const existing = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, input.email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: 'Este e-mail já está na lista de espera.',
        code: 'DUPLICATE',
      };
    }

    // 4. Insert record
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    await db.insert(waitlist).values({
      email: input.email.toLowerCase().trim(),
      status: 'pending',
      metadata: metadataJson,
    });

    // 5. PostHog server-side event
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: input.email.toLowerCase().trim(),
        event: 'waitlist_joined',
        properties: {
          email: input.email.toLowerCase().trim(),
          ...input.metadata,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Waitlist join error:', error);
    return {
      success: false,
      error: 'Algo deu errado. Tente novamente.',
      code: 'ERROR',
    };
  }
}
