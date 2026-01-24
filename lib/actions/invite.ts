'use server';

import { db } from '@/lib/db';
import { invites } from '@/lib/auth-schema';
import { randomUUID } from 'crypto';
import { getCurrentUserId } from '@/lib/auth';
import { checkCrudRateLimit } from '@/lib/rate-limit';

/**
 * Generates a human-readable invite code
 * Format: FLUXO-XXXXX (5 random chars)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `FLUXO-${code}`;
}

export type CreateInviteParams = {
  email?: string;
  expiresInDays?: number;
  maxUses?: number;
  createdBy?: string;
};

export type CreateInviteResult = {
  success: boolean;
  code?: string;
  error?: string;
};

/**
 * Creates a new invite code (admin function)
 * SECURITY: Requires authentication
 */
export async function createInvite(params: CreateInviteParams = {}): Promise<CreateInviteResult> {
  const { email, expiresInDays, maxUses = 1 } = params;

  try {
    // CRITICAL: Require authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Não autorizado' };
    }

    // Rate limiting
    const rateLimit = await checkCrudRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Muitas requisições. Tente novamente em ${rateLimit.retryAfter}s`,
      };
    }

    const code = generateInviteCode();
    const id = randomUUID();

    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await db.insert(invites).values({
      id,
      code,
      email: email || null,
      createdBy: userId, // Track who created the invite
      expiresAt,
      maxUses,
      useCount: 0,
    });

    return { success: true, code };
  } catch (error) {
    console.error('Create invite error:', error);
    return { success: false, error: 'Erro ao criar convite' };
  }
}
