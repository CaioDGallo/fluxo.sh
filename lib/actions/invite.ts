'use server';

import { db } from '@/lib/db';
import { invites, users } from '@/lib/auth-schema';
import { randomUUID } from 'crypto';
import { getCurrentUserId } from '@/lib/auth';
import { checkCrudRateLimit } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_PLAN_KEY,
  PLAN_INTERVALS,
  PLAN_KEYS,
  resolvePlanInterval,
  type PlanInterval,
  type PlanKey,
} from '@/lib/plans';

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
  createdByEmail?: string;
  planKey?: PlanKey;
  planInterval?: PlanInterval;
};

type CreateInviteRecordParams = {
  email?: string;
  expiresInDays?: number;
  maxUses?: number;
  createdById?: string | null;
  planKey?: PlanKey;
  planInterval?: PlanInterval;
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
  try {
    return await createInviteRecord(params);
  } catch (error) {
    console.error('Create invite error:', error);
    return { success: false, error: 'Erro ao criar convite' };
  }
}

export async function createInviteWithoutAuth(
  params: CreateInviteRecordParams = {}
): Promise<CreateInviteResult> {
  try {
    return await createInviteRecord(params);
  } catch (error) {
    console.error('Create invite error:', error);
    return { success: false, error: 'Erro ao criar convite' };
  }
}

async function createInviteRecord(params: CreateInviteParams | CreateInviteRecordParams) {
  const { email, expiresInDays, maxUses = 1, planKey, planInterval } = params;

  if (planKey && !PLAN_KEYS.includes(planKey)) {
    return { success: false, error: 'Plano inválido' };
  }

  if (planInterval && !PLAN_INTERVALS.includes(planInterval)) {
    return { success: false, error: 'Periodicidade inválida' };
  }

  let userId: string | undefined | null = null;
  if ('createdById' in params) {
    userId = params.createdById ?? null;
  } else if ('createdBy' in params || 'createdByEmail' in params) {
    const createdBy = 'createdBy' in params ? params.createdBy : undefined;
    const createdByEmail = 'createdByEmail' in params ? params.createdByEmail : undefined;
    userId = createdBy;
    if (!userId && createdByEmail) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, createdByEmail.toLowerCase()))
        .limit(1);
      userId = user?.id;
      if (!userId) {
        return { success: false, error: 'Usuário não encontrado' };
      }
    }

    if (!userId) {
      // CRITICAL: Require authentication
      try {
        userId = await getCurrentUserId();
      } catch {
        return { success: false, error: 'Não autorizado' };
      }
    }

    // Rate limiting
    const rateLimit = await checkCrudRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Muitas requisições. Tente novamente em ${rateLimit.retryAfter}s`,
      };
    }
  }

  const code = generateInviteCode();
  const id = randomUUID();

  let expiresAt: Date | null = null;
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  const resolvedPlanInterval =
    planKey && planKey !== DEFAULT_PLAN_KEY ? resolvePlanInterval(planInterval) : null;

  await db.insert(invites).values({
    id,
    code,
    email: email || null,
    planKey: planKey ?? null,
    planInterval: resolvedPlanInterval,
    createdBy: userId, // Track who created the invite
    expiresAt,
    maxUses,
    useCount: 0,
  });

  return { success: true, code };
}
