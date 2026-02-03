import { db } from '@/lib/db';
import { accounts, income, transactions, transfers } from '@/lib/schema';
import { t } from '@/lib/i18n/server-errors';
import { and, eq } from 'drizzle-orm';

export type GuardableEntity = 'account' | 'expense' | 'income' | 'transfer';

/**
 * Throws if the entity is synced from Pluggy and cannot be manually edited/deleted.
 * Allowed operations: category updates, ignore toggles, payment status changes.
 */
export async function assertNotPluggySynced(
  entityType: GuardableEntity,
  entityId: number,
  userId: string
): Promise<void> {
  let isSynced = false;

  switch (entityType) {
    case 'account': {
      // Check if account.source === 'pluggy'
      const [account] = await db
        .select({ source: accounts.source })
        .from(accounts)
        .where(and(eq(accounts.id, entityId), eq(accounts.userId, userId)))
        .limit(1);

      if (account?.source === 'pluggy') {
        isSynced = true;
      }
      break;
    }

    case 'expense': {
      // Check if transaction has externalId (synced from Pluggy)
      const [transaction] = await db
        .select({ externalId: transactions.externalId })
        .from(transactions)
        .where(and(eq(transactions.id, entityId), eq(transactions.userId, userId)))
        .limit(1);

      if (transaction?.externalId) {
        isSynced = true;
      }
      break;
    }

    case 'income': {
      // Check if income has externalId (synced from Pluggy)
      const [incomeRow] = await db
        .select({ externalId: income.externalId })
        .from(income)
        .where(and(eq(income.id, entityId), eq(income.userId, userId)))
        .limit(1);

      if (incomeRow?.externalId) {
        isSynced = true;
      }
      break;
    }

    case 'transfer': {
      // Check if transfer has externalId (synced from Pluggy)
      const [transfer] = await db
        .select({ externalId: transfers.externalId })
        .from(transfers)
        .where(and(eq(transfers.id, entityId), eq(transfers.userId, userId)))
        .limit(1);

      if (transfer?.externalId) {
        isSynced = true;
      }
      break;
    }
  }

  if (isSynced) {
    throw new Error(await t('errors.pluggySyncedReadOnly'));
  }
}
