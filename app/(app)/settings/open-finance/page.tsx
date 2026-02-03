import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { accounts, pluggyAccounts, pluggyItems } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { OpenFinanceClient } from './open-finance-client';

export default async function OpenFinancePage() {
  const t = await getTranslations('openFinance');
  const userId = await getCurrentUserId();

  const items = await db
    .select({
      id: pluggyItems.id,
      pluggyItemId: pluggyItems.pluggyItemId,
      connectorId: pluggyItems.connectorId,
      status: pluggyItems.status,
      statusDetail: pluggyItems.statusDetail,
      lastUpdatedAt: pluggyItems.lastUpdatedAt,
      lastSyncedAt: pluggyItems.lastSyncedAt,
      nextSyncAt: pluggyItems.nextSyncAt,
      lastError: pluggyItems.lastError,
      consentExpiresAt: pluggyItems.consentExpiresAt,
      errorCount: pluggyItems.errorCount,
      createdAt: pluggyItems.createdAt,
    })
    .from(pluggyItems)
    .where(eq(pluggyItems.userId, userId))
    .orderBy(asc(pluggyItems.createdAt));

  const mappedAccounts = await db
    .select({
      id: pluggyAccounts.id,
      itemId: pluggyAccounts.itemId,
      pluggyItemId: pluggyItems.pluggyItemId,
      pluggyAccountId: pluggyAccounts.pluggyAccountId,
      name: pluggyAccounts.name,
      type: pluggyAccounts.type,
      subtype: pluggyAccounts.subtype,
      currency: pluggyAccounts.currency,
      mask: pluggyAccounts.mask,
      institutionName: pluggyAccounts.institutionName,
      accountId: pluggyAccounts.accountId,
      accountName: accounts.name,
      accountType: accounts.type,
      accountSource: accounts.source,
      createdAt: pluggyAccounts.createdAt,
    })
    .from(pluggyAccounts)
    .leftJoin(accounts, eq(pluggyAccounts.accountId, accounts.id))
    .leftJoin(pluggyItems, eq(pluggyAccounts.itemId, pluggyItems.id))
    .where(eq(pluggyAccounts.userId, userId))
    .orderBy(asc(pluggyAccounts.createdAt));

  const serializedItems = items.map((item) => ({
    ...item,
    lastUpdatedAt: item.lastUpdatedAt?.toISOString() ?? null,
    lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
    nextSyncAt: item.nextSyncAt?.toISOString() ?? null,
    consentExpiresAt: item.consentExpiresAt?.toISOString() ?? null,
    createdAt: item.createdAt?.toISOString() ?? null,
  }));

  const serializedAccounts = mappedAccounts.map((account) => ({
    ...account,
    createdAt: account.createdAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('description')}</p>
      <OpenFinanceClient
        items={serializedItems}
        pluggyAccounts={serializedAccounts}
      />
    </div>
  );
}
