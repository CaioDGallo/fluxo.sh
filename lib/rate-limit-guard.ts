import { checkCrudRateLimit } from './rate-limit';
import { getCurrentUserId } from './auth';

/**
 * Helper to guard CRUD operations with rate limiting
 * Throws an error if rate limit is exceeded
 */
export async function guardCrudOperation(): Promise<void> {
  const userId = await getCurrentUserId();
  const rateLimit = await checkCrudRateLimit(userId);

  if (!rateLimit.allowed) {
    throw new Error(`Muitas requisições. Tente novamente em ${rateLimit.retryAfter}s`);
  }
}
