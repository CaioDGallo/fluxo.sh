import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n/server-errors';
import type { AccountInfo } from '@/lib/import-helpers';
import { accounts, pluggyAccounts } from '@/lib/schema';
import type { PluggyAccount } from '@/lib/pluggy/client';

type EnsurePluggyAccountParams = {
  userId: string;
  pluggyItemRowId: number;
  pluggyAccount: PluggyAccount;
  itemPayload?: { connectorId?: string | null } | null;
};

export type EnsurePluggyAccountResult = {
  accountId: number;
  accountInfo: AccountInfo;
  created: boolean;
  replacedManual: boolean;
};

function resolveAccountType(account: PluggyAccount): 'credit_card' | 'checking' | 'savings' | 'cash' {
  const type = account.type?.toLowerCase() ?? '';
  const subtype = account.subtype?.toLowerCase() ?? '';

  if (type.includes('credit') || subtype.includes('credit')) return 'credit_card';
  if (type.includes('savings') || subtype.includes('savings')) return 'savings';
  if (type.includes('cash') || subtype.includes('cash')) return 'cash';
  if (type.includes('checking') || subtype.includes('checking') || subtype.includes('transaction')) return 'checking';
  if (type.includes('bank')) return 'checking';
  return 'checking';
}

const GENERIC_CARD_TOKENS = new Set([
  'platinum',
  'gold',
  'black',
  'infinite',
  'signature',
  'classic',
  'standard',
  'international',
  'prime',
  'elite',
  'basic',
  'rewards',
  'unique',
  'ultra',
  'virtual',
]);

const GENERIC_CARD_WORDS = new Set([
  ...GENERIC_CARD_TOKENS,
  'visa',
  'mastercard',
  'amex',
  'american',
  'express',
  'elo',
  'hipercard',
  'diners',
  'card',
  'cartao',
  'credito',
  'credit',
]);

function isGenericCardName(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return true;
  if (GENERIC_CARD_TOKENS.has(normalized)) return true;
  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => GENERIC_CARD_WORDS.has(token));
}

function resolveAccountName(account: PluggyAccount, type: string, institutionName: string | null): string {
  const name = account.marketingName ?? account.name ?? '';
  const trimmedName = name.trim();
  const trimmedInstitution = institutionName?.trim() ?? '';

  if (trimmedName) {
    if (type === 'credit_card' && trimmedInstitution && isGenericCardName(trimmedName)) {
      return trimmedInstitution;
    }
    return trimmedName;
  }

  if (trimmedInstitution) return trimmedInstitution;
  if (type === 'credit_card') return 'Cartao Pluggy';
  return 'Conta Pluggy';
}

function resolveInstitutionName(account: PluggyAccount): string | null {
  if (!account.bankData || typeof account.bankData !== 'object') return null;
  const institution = (account.bankData as Record<string, unknown>).institution;
  if (!institution || typeof institution !== 'object') return null;
  const name = (institution as Record<string, unknown>).name;
  return typeof name === 'string' ? name : null;
}

function resolveAccountInfo(account: {
  id: number;
  type: string;
  closingDay: number | null;
  paymentDueDay: number | null;
}): AccountInfo {
  return {
    type: account.type,
    closingDay: account.closingDay ?? null,
    paymentDueDay: account.paymentDueDay ?? null,
  };
}

export async function ensurePluggyAccountMapping({
  userId,
  pluggyItemRowId,
  pluggyAccount,
  itemPayload,
}: EnsurePluggyAccountParams): Promise<EnsurePluggyAccountResult> {
  const type = resolveAccountType(pluggyAccount);
  const institutionName = resolveInstitutionName(pluggyAccount);
  const name = resolveAccountName(pluggyAccount, type, institutionName);
  const currency = pluggyAccount.currencyCode ?? 'BRL';
  const mask = pluggyAccount.number?.slice(-4) ?? null;
  const institutionId = itemPayload?.connectorId ?? null;

  const [existingMapping] = await db
    .select({ id: pluggyAccounts.id, accountId: pluggyAccounts.accountId })
    .from(pluggyAccounts)
    .where(and(
      eq(pluggyAccounts.userId, userId),
      eq(pluggyAccounts.pluggyAccountId, pluggyAccount.id)
    ))
    .limit(1);

  let existingAccount: {
    id: number;
    name: string;
    source: string;
    type: string;
    closingDay: number | null;
    paymentDueDay: number | null;
  } | null = null;

  if (existingMapping?.accountId) {
    const [accountRow] = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        source: accounts.source,
        type: accounts.type,
        closingDay: accounts.closingDay,
        paymentDueDay: accounts.paymentDueDay,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, existingMapping.accountId)))
      .limit(1);
    existingAccount = accountRow ?? null;
  }

  const shouldCreateNew =
    !existingMapping ||
    !existingMapping.accountId ||
    !existingAccount ||
    existingAccount.source !== 'pluggy';

  let accountId = existingAccount?.id ?? 0;
  let accountInfo = existingAccount ? resolveAccountInfo(existingAccount) : { type, closingDay: null, paymentDueDay: null };
  let created = false;
  let replacedManual = false;

  if (shouldCreateNew) {
    const [createdAccount] = await db
      .insert(accounts)
      .values({
        userId,
        name,
        type,
        source: 'pluggy',
        currency,
      })
      .returning({
        id: accounts.id,
        type: accounts.type,
        closingDay: accounts.closingDay,
        paymentDueDay: accounts.paymentDueDay,
      });

    if (!createdAccount) {
      throw new Error(await t('errors.failedToCreate'));
    }

    created = true;
    replacedManual = existingAccount?.source === 'manual';
    accountId = createdAccount.id;
    accountInfo = resolveAccountInfo(createdAccount);
  }

  if (!shouldCreateNew && existingAccount?.source === 'pluggy' && existingAccount.name !== name) {
    await db
      .update(accounts)
      .set({ name })
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
  }

  if (existingMapping) {
    await db
      .update(pluggyAccounts)
      .set({
        itemId: pluggyItemRowId,
        accountId,
        name,
        type: pluggyAccount.type,
        subtype: pluggyAccount.subtype ?? null,
        currency,
        mask,
        institutionId,
        institutionName,
        updatedAt: new Date(),
      })
      .where(eq(pluggyAccounts.id, existingMapping.id));
  } else {
    await db
      .insert(pluggyAccounts)
      .values({
        userId,
        itemId: pluggyItemRowId,
        pluggyAccountId: pluggyAccount.id,
        accountId,
        name,
        type: pluggyAccount.type,
        subtype: pluggyAccount.subtype ?? null,
        currency,
        mask,
        institutionId,
        institutionName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }

  return {
    accountId,
    accountInfo,
    created,
    replacedManual,
  };
}
