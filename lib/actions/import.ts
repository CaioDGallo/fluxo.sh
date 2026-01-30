'use server';

import { syncAccountBalance } from '@/lib/actions/accounts';
import { getDefaultImportCategories } from '@/lib/actions/categories';
import { bulkIncrementCategoryFrequency } from '@/lib/actions/category-frequency';
import {
  batchEnsureFaturasExist,
  batchRecalculateInstallmentDates,
  batchUpdateFaturaTotals,
  ensureFaturaExists,
  updateFaturaTotal,
} from '@/lib/actions/faturas';
import { trackFirstBulkImport, trackFirstExpense, trackUserActivity } from '@/lib/analytics';
import { getCurrentUserId } from '@/lib/auth';
import { users } from '@/lib/auth-schema';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/db-errors';
import { computeClosingDate, getFaturaMonth, getFaturaMonthFromClosingDate, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { t } from '@/lib/i18n/server-errors';
import { calculateBasePurchaseDate, computeEntryDates, type AccountInfo } from '@/lib/import-helpers';
import { findRefundMatches } from '@/lib/import/refund-matcher';
import type { CategorySuggestion, ValidatedImportRow } from '@/lib/import/types';
import { getUserEntitlements } from '@/lib/plan-entitlements';
import { getUsageCount, getUserTimezone, getWeeklyWindow, incrementUsageCount } from '@/lib/plan-usage';
import { getPostHogClient } from '@/lib/posthog-server';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { accounts, categories, categoryFrequency, entries, income, transactions, transfers } from '@/lib/schema';
import { addMonths } from '@/lib/utils';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type SuggestionsInput = {
  expenseDescriptions: string[];
  incomeDescriptions: string[];
};

type SuggestionsResult = {
  expense: Record<string, CategorySuggestion>;
  income: Record<string, CategorySuggestion>;
};

async function fetchExistingExternalIds(
  userId: string,
  externalIds: string[]
): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(externalIds.filter((id): id is string => !!id)));

  if (uniqueIds.length === 0) {
    return new Set<string>();
  }

  const [existingTransactions, existingIncome, existingTransfers] = await Promise.all([
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, uniqueIds))),
    db
      .select({ externalId: income.externalId })
      .from(income)
      .where(and(eq(income.userId, userId), inArray(income.externalId, uniqueIds))),
    db
      .select({ externalId: transfers.externalId })
      .from(transfers)
      .where(and(eq(transfers.userId, userId), inArray(transfers.externalId, uniqueIds))),
  ]);

  return new Set([
    ...existingTransactions.map((t) => t.externalId).filter((id): id is string => !!id),
    ...existingIncome.map((i) => i.externalId).filter((id): id is string => !!id),
    ...existingTransfers.map((t) => t.externalId).filter((id): id is string => !!id),
  ]);
}

export async function getCategorySuggestions(
  input: SuggestionsInput
): Promise<SuggestionsResult> {
  const { expenseDescriptions, incomeDescriptions } = input;
  const userId = await getCurrentUserId();

  const expenseMap: Record<string, CategorySuggestion> = {};
  const incomeMap: Record<string, CategorySuggestion> = {};

  // Helper to normalize descriptions
  const normalizeDescription = (desc: string) => desc.trim().toLowerCase();

  if (expenseDescriptions.length > 0) {
    // Create map from normalized to original descriptions
    const normalizedToOriginal = expenseDescriptions.reduce(
      (acc, desc) => {
        const normalized = normalizeDescription(desc);
        if (!acc[normalized]) {
          acc[normalized] = desc; // Keep first occurrence as canonical
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const normalizedDescriptions = Object.keys(normalizedToOriginal);

    const expenseFrequency = await db
      .select({
        descriptionNormalized: categoryFrequency.descriptionNormalized,
        categoryId: categoryFrequency.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        count: categoryFrequency.count,
        lastUsedAt: categoryFrequency.lastUsedAt,
      })
      .from(categoryFrequency)
      .innerJoin(categories, eq(categoryFrequency.categoryId, categories.id))
      .where(
        and(
          eq(categoryFrequency.userId, userId),
          eq(categoryFrequency.type, 'expense'),
          inArray(categoryFrequency.descriptionNormalized, normalizedDescriptions)
        )
      )
      .orderBy(desc(categoryFrequency.count), desc(categoryFrequency.lastUsedAt));

    for (const record of expenseFrequency) {
      const originalDescription = normalizedToOriginal[record.descriptionNormalized];
      if (originalDescription && !expenseMap[originalDescription]) {
        expenseMap[originalDescription] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  if (incomeDescriptions.length > 0) {
    // Create map from normalized to original descriptions
    const normalizedToOriginal = incomeDescriptions.reduce(
      (acc, desc) => {
        const normalized = normalizeDescription(desc);
        if (!acc[normalized]) {
          acc[normalized] = desc; // Keep first occurrence as canonical
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const normalizedDescriptions = Object.keys(normalizedToOriginal);

    const incomeFrequency = await db
      .select({
        descriptionNormalized: categoryFrequency.descriptionNormalized,
        categoryId: categoryFrequency.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        count: categoryFrequency.count,
        lastUsedAt: categoryFrequency.lastUsedAt,
      })
      .from(categoryFrequency)
      .innerJoin(categories, eq(categoryFrequency.categoryId, categories.id))
      .where(
        and(
          eq(categoryFrequency.userId, userId),
          eq(categoryFrequency.type, 'income'),
          inArray(categoryFrequency.descriptionNormalized, normalizedDescriptions)
        )
      )
      .orderBy(desc(categoryFrequency.count), desc(categoryFrequency.lastUsedAt));

    for (const record of incomeFrequency) {
      const originalDescription = normalizedToOriginal[record.descriptionNormalized];
      if (originalDescription && !incomeMap[originalDescription]) {
        incomeMap[originalDescription] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  return { expense: expenseMap, income: incomeMap };
}

export async function checkDuplicates(externalIds: string[]): Promise<string[]> {
  const userId = await getCurrentUserId();
  const existingIds = await fetchExistingExternalIds(userId, externalIds);
  return Array.from(existingIds);
}

type ImportExpenseData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryId: number;
};

type ImportResult =
  | {
    success: true;
    imported: number;
  }
  | {
    success: false;
    error: string;
  };

export async function importExpenses(data: ImportExpenseData): Promise<ImportResult> {
  const { rows, accountId, categoryId } = data;

  if (rows.length === 0) {
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId and categoryId exist
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { success: false, error: await t('errors.invalidCategoryId') };
  }

  try {
    const userId = await getCurrentUserId();

    const [entitlements, timezone] = await Promise.all([
      getUserEntitlements(userId),
      getUserTimezone(userId),
    ]);

    const importWindow = getWeeklyWindow(timezone);
    const importCount = await getUsageCount(userId, 'import_weekly', importWindow);

    if (importCount >= entitlements.limits.importWeekly) {
      return {
        success: false,
        error: await t('errors.importLimitReached', { limit: entitlements.limits.importWeekly }),
      };
    }

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Verify account exists and fetch billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).limit(1);
    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Verify category exists
    const category = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.id, categoryId))).limit(1);
    if (category.length === 0) {
      return { success: false, error: await t('errors.categoryNotFound') };
    }

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // Pre-calculate all transaction and entry values
      const transactionValues: Array<{
        userId: string;
        description: string;
        totalAmount: number;
        totalInstallments: number;
        categoryId: number;
      }> = [];
      const entryMetadata: Array<{
        amountCents: number;
        purchaseDate: string;
        faturaMonth: string;
        dueDate: string;
      }> = [];

      for (const row of rows) {
        // Calculate fatura month and due date based on account type
        let faturaMonth: string;
        let dueDate: string;

        if (hasBillingConfig) {
          // Credit card with billing config: compute fatura month and due date
          const purchaseDate = new Date(row.date + 'T00:00:00Z');
          faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
          dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
          affectedFaturas.add(faturaMonth);
        } else {
          // Non-credit card or card without config: fatura = purchase month
          faturaMonth = row.date.slice(0, 7);
          dueDate = row.date;
        }

        transactionValues.push({
          userId,
          description: row.description,
          totalAmount: row.amountCents,
          totalInstallments: 1,
          categoryId,
        });

        entryMetadata.push({
          amountCents: row.amountCents,
          purchaseDate: row.date,
          faturaMonth,
          dueDate,
        });
      }

      // Bulk insert transactions with returning (PostgreSQL guarantees order)
      const insertedTxs = await tx
        .insert(transactions)
        .values(transactionValues)
        .returning({ id: transactions.id });

      // Map entry values using returned IDs
      const entryValues = insertedTxs.map((tx, i) => ({
        userId,
        transactionId: tx.id,
        accountId,
        amount: entryMetadata[i].amountCents,
        purchaseDate: entryMetadata[i].purchaseDate,
        faturaMonth: entryMetadata[i].faturaMonth,
        dueDate: entryMetadata[i].dueDate,
        installmentNumber: 1,
        paidAt: null,
      }));

      // Bulk insert entries
      await tx.insert(entries).values(entryValues);
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig && affectedFaturas.size > 0) {
      const months = Array.from(affectedFaturas);
      await batchEnsureFaturasExist(accountId, months);
      await batchUpdateFaturaTotals(accountId, months);
    }

    await syncAccountBalance(accountId);

    // Analytics: Track first expense and first bulk import
    const [entryCountBefore, user] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(entries).where(eq(entries.userId, userId)),
      db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
    ]);

    const totalEntriesBefore = Number(entryCountBefore[0]?.count || 0) - rows.length;
    const isFirstExpense = totalEntriesBefore === 0;

    if (isFirstExpense && user[0]?.createdAt) {
      await trackFirstExpense({
        userId,
        wasImported: true,
        accountType: account[0].type,
        userCreatedAt: user[0].createdAt,
        hadCategorySuggestion: false,
      });
    }

    // Track first bulk import (5+ rows)
    if (user[0]?.createdAt) {
      await trackFirstBulkImport({
        userId,
        importType: 'expenses',
        expenseCount: rows.length,
        incomeCount: 0,
        rowCount: rows.length,
        accountType: account[0].type,
        bankSource: 'other', // TODO: Detect from parser metadata
        hadDuplicates: false, // TODO: Track skipped duplicates
        installmentsDetected: false, // Single-installment imports
        userCreatedAt: user[0].createdAt,
      });
    }

    await trackUserActivity({
      userId,
      activityType: 'create_expense',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'import_completed',
        properties: {
          import_type: 'expenses',
          row_count: rows.length,
          account_id: accountId,
          is_credit_card: isCreditCard,
        },
      });
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');

    try {
      await incrementUsageCount(userId, 'import_weekly', importWindow);
    } catch (error) {
      console.error('[import:usage] Failed to increment weekly import counter:', error);
    }

    return { success: true, imported: rows.length };
  } catch (error) {
    console.error('[import:expenses] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToImport') };
  }
}

type ImportMixedData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryOverrides?: Record<number, number>;
  faturaOverrides?: { startDate?: string; closingDate?: string; dueDate?: string };
};

type ImportMixedResult =
  | {
    success: true;
    importedExpenses: number;
    importedIncome: number;
    skippedDuplicates: number;
  }
  | {
    success: false;
    error: string;
  };

// Helper: Find existing installment transaction by description and total installments
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function findExistingInstallmentTransaction(
  dbClient: DbClient,
  userId: string,
  baseDescription: string,
  totalInstallments: number,
  _installmentAmounts: Map<number, number>,
  excludeTransactionIds: Set<number>,
  rawFitId?: string
): Promise<{
  id: number;
  existingEntryNumbers: number[];
  existingAmounts: Map<number, number>;
  existingEntryIds: Map<number, number>;
} | null> {
  // Find transaction by description pattern (case-insensitive) and installment count
  // Excludes transactions created in the current import batch
  const results = await dbClient
    .select({
      id: transactions.id,
      externalId: transactions.externalId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.totalInstallments, totalInstallments),
        sql`LOWER(${transactions.description}) LIKE LOWER(${'%' + baseDescription + '%'})`
      )
    )
    .limit(10); // Get multiple to check exclusions

  // Filter out excluded transactions (created in current batch)
  const candidateResults = results.filter((tx) => !excludeTransactionIds.has(tx.id));
  if (candidateResults.length === 0) return null;

  // For OFX imports with rawFitId, only match if transaction has same FITID prefix
  let tx = null;
  for (const candidate of candidateResults) {
    if (rawFitId && candidate.externalId) {
      // OFX: Check if existing transaction has matching FITID prefix
      // externalId format: {FITID}-{amount} (e.g., "694072e2-...-3000")
      const existingFitId = candidate.externalId.split('-')[0];
      const importFitId = rawFitId.split('-')[0];

      // Only match if same purchase (same FITID prefix)
      if (existingFitId !== importFitId) {
        continue; // Different purchase, skip this candidate
      }
    }
    tx = candidate;
    break;
  }

  if (!tx) return null;

  // Get existing entries with their amounts and IDs for this transaction
  const existingEntries = await dbClient
    .select({
      id: entries.id,
      installmentNumber: entries.installmentNumber,
      amount: entries.amount,
    })
    .from(entries)
    .where(eq(entries.transactionId, tx.id));

  const existingAmounts = new Map(existingEntries.map((e) => [e.installmentNumber, e.amount]));
  const existingEntryIds = new Map(existingEntries.map((e) => [e.installmentNumber, e.id]));

  // No conflict detection for transactions from previous imports - allow updates
  // The grouping logic already prevents merging different purchases within the same batch
  return {
    id: tx.id,
    existingEntryNumbers: existingEntries.map((e) => e.installmentNumber),
    existingAmounts,
    existingEntryIds,
  };
}

// Type definitions and helper functions moved to @/lib/import-helpers
// to allow testing without "use server" async requirement

// Helper: Process a group of installment rows
async function processInstallmentGroup(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  rows: ValidatedImportRow[],
  account: AccountInfo & { id: number },
  categoryOverrides: Record<number, number>,
  expenseCategoryId: number,
  affectedFaturas: Set<string>,
  newlyCreatedTransactionIds: Set<number>,
  ofxClosingDate?: string
) {
  // All rows in group have same baseDescription and total
  const firstRow = rows[0];
  const { baseDescription, total } = firstRow.installmentInfo!;

  // Sort by installment number
  rows.sort((a, b) => a.installmentInfo!.current - b.installmentInfo!.current);

  const rowAmounts = new Map<number, number>();
  for (const row of rows) {
    rowAmounts.set(row.installmentInfo!.current, row.amountCents);
  }

  const fallbackAmount = firstRow.amountCents;

  // Check if transaction already exists (returns null if conflicting amounts detected)
  // Excludes transactions created in the current import batch
  const existing = await findExistingInstallmentTransaction(
    tx,
    userId,
    baseDescription,
    total,
    rowAmounts,
    newlyCreatedTransactionIds,
    rows[0].rawFitId
  );
  const getInstallmentAmount = (
    installmentNumber: number,
    existingAmounts: Map<number, number>
  ) => rowAmounts.get(installmentNumber) ?? existingAmounts.get(installmentNumber) ?? fallbackAmount;

  let transactionId: number;
  let entriesToCreate: number[];
  let existingAmounts = new Map<number, number>();
  let existingEntryIds = new Map<number, number>();

  if (existing) {
    // Transaction exists - only create missing entries
    transactionId = existing.id;
    existingAmounts = existing.existingAmounts;
    existingEntryIds = existing.existingEntryIds;

    const existingSet = new Set(existing.existingEntryNumbers);
    entriesToCreate = rows
      .map((r) => r.installmentInfo!.current)
      .filter((n) => !existingSet.has(n));
  } else {
    // Determine which entries to create based on imported parcelas
    const minInstallment = rows[0].installmentInfo!.current;

    if (minInstallment === 1) {
      // Parcela 1 present: create all N entries
      entriesToCreate = Array.from({ length: total }, (_, i) => i + 1);
    } else {
      // Parcela M>1 only: create entries from M to N
      entriesToCreate = Array.from(
        { length: total - minInstallment + 1 },
        (_, i) => minInstallment + i
      );
    }

    // Get category from first row
    const categoryId = categoryOverrides[firstRow.rowIndex] ?? expenseCategoryId;

    const totalAmount = Array.from({ length: total }, (_, i) =>
      getInstallmentAmount(i + 1, existingAmounts)
    ).reduce((sum, amount) => sum + amount, 0);

    // Create transaction
    const [transaction] = await tx
      .insert(transactions)
      .values({
        userId,
        description: firstRow.description, // Keep full description with "Parcela X/Y"
        totalAmount,
        totalInstallments: total,
        categoryId,
        externalId: firstRow.externalId,
      })
      .returning();

    transactionId = transaction.id;
    // Track this transaction ID to prevent other groups from matching it
    newlyCreatedTransactionIds.add(transactionId);
  }

  // Create entries for each installment
  const baseDate = calculateBasePurchaseDate(rows);

  // Calculate base fatura month for installments
  // For OFX imports with historic installments, work backwards from OFX fatura month
  const minInstallment = rows[0].installmentInfo!.current;
  let baseFaturaMonthOverride: string | undefined;

  if (ofxClosingDate && account.type === 'credit_card' && account.closingDay) {
    // OFX fatura month = closing date's month (YYYY-MM)
    const ofxFaturaMonth = ofxClosingDate.slice(0, 7);
    // If installment N is in ofxFaturaMonth, installment 1 was in ofxFaturaMonth - (N-1) months
    baseFaturaMonthOverride = addMonths(ofxFaturaMonth, -(minInstallment - 1));
  }

  if (existing) {
    // Bulk update existing entries with new amounts
    for (const row of rows) {
      const installmentNumber = row.installmentInfo!.current;
      const entryId = existingEntryIds.get(installmentNumber);
      if (!entryId) continue;

      const existingAmount = existingAmounts.get(installmentNumber);
      if (existingAmount === row.amountCents) continue;

      await tx
        .update(entries)
        .set({ amount: row.amountCents })
        .where(eq(entries.id, entryId));

      existingAmounts.set(installmentNumber, row.amountCents);

      const dates = computeEntryDates(baseDate, installmentNumber, account, ofxClosingDate, baseFaturaMonthOverride);
      affectedFaturas.add(dates.faturaMonth);
    }
  }

  // Bulk create new entries
  if (entriesToCreate.length > 0) {
    const entryValues: Array<{
      userId: string;
      transactionId: number;
      accountId: number;
      amount: number;
      purchaseDate: string;
      faturaMonth: string;
      dueDate: string;
      installmentNumber: number;
      paidAt: null;
    }> = [];
    for (const installmentNumber of entriesToCreate) {
      const dates = computeEntryDates(baseDate, installmentNumber, account, ofxClosingDate, baseFaturaMonthOverride);
      affectedFaturas.add(dates.faturaMonth);

      const amount = getInstallmentAmount(installmentNumber, existingAmounts);
      entryValues.push({
        userId,
        transactionId,
        accountId: account.id,
        amount,
        purchaseDate: dates.purchaseDate,
        faturaMonth: dates.faturaMonth,
        dueDate: dates.dueDate,
        installmentNumber,
        paidAt: null,
      });

      existingAmounts.set(installmentNumber, amount);
    }

    await tx.insert(entries).values(entryValues);
  }

  if (existing) {
    const totalAmount = Array.from({ length: total }, (_, i) =>
      getInstallmentAmount(i + 1, existingAmounts)
    ).reduce((sum, amount) => sum + amount, 0);

    await tx.update(transactions).set({ totalAmount }).where(eq(transactions.id, transactionId));
  }
}

export async function importMixed(data: ImportMixedData): Promise<ImportMixedResult> {
  const { rows, accountId, categoryOverrides = {}, faturaOverrides } = data;

  if (rows.length === 0) {
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }

  try {
    const userId = await getCurrentUserId();

    const [entitlements, timezone] = await Promise.all([
      getUserEntitlements(userId),
      getUserTimezone(userId),
    ]);

    const importWindow = getWeeklyWindow(timezone);
    const importCount = await getUsageCount(userId, 'import_weekly', importWindow);

    if (importCount >= entitlements.limits.importWeekly) {
      return {
        success: false,
        error: await t('errors.importLimitReached', { limit: entitlements.limits.importWeekly }),
      };
    }

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Get default import categories
    const defaultCategories = await getDefaultImportCategories();
    if (!defaultCategories.expense) {
      return { success: false, error: await t('errors.noDefaultExpenseCategory') };
    }
    if (!defaultCategories.income) {
      return { success: false, error: await t('errors.noDefaultIncomeCategory') };
    }

    const expenseCategoryId = defaultCategories.expense.id;
    const incomeCategoryId = defaultCategories.income.id;

    // Verify account exists and fetch billing config
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
      .limit(1);

    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Separate rows by type
    const expenseRows = rows.filter((r) => r.type === 'expense');
    const incomeRows = rows.filter((r) => r.type === 'income');

    // Collect external IDs for duplicate detection
    const externalIds = rows.map((r) => r.externalId).filter((id): id is string => !!id);
    const existingIds = await fetchExistingExternalIds(userId, externalIds);

    // Filter out duplicates
    const newExpenses = expenseRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const newIncome = incomeRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const skippedDuplicates = rows.length - newExpenses.length - newIncome.length;

    // Find refund matches for income candidates
    const refundMatches = await findRefundMatches(userId, accountId, newIncome);

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Separate installment and regular expenses
    const installmentExpenses = newExpenses.filter((r) => r.installmentInfo);
    const regularExpenses = newExpenses.filter((r) => !r.installmentInfo);

    // Group installment expenses by base description + total
    // Handle multiple purchases from same store by splitting when installment numbers collide
    const installmentGroups = new Map<string, ValidatedImportRow[]>();
    // Track installment# → {amount, externalId} for each group to detect conflicts
    const groupInstallmentData = new Map<string, Map<number, { amount: number; externalId?: string }>>();

    for (const row of installmentExpenses) {
      const info = row.installmentInfo!;

      let targetKey: string;

      if (row.rawFitId) {
        // OFX: Each FITID is unique - no grouping needed
        targetKey = row.rawFitId;

        // Initialize group if needed
        if (!installmentGroups.has(targetKey)) {
          installmentGroups.set(targetKey, []);
          groupInstallmentData.set(targetKey, new Map());
        }

        // Skip if duplicate installment number with same externalId
        const existingData = groupInstallmentData.get(targetKey)!;
        const existing = existingData.get(info.current);
        if (existing?.externalId && existing.externalId === row.externalId) {
          continue;
        }
      } else {
        // CSV: Group by description, handle conflicts with amount check
        const baseKey = `${info.baseDescription.toLowerCase()}|${info.total}`;
        targetKey = baseKey;
        let suffix = 0;

        while (true) {
          const existingData = groupInstallmentData.get(targetKey);
          if (!existingData) {
            // New group
            installmentGroups.set(targetKey, []);
            groupInstallmentData.set(targetKey, new Map());
            break;
          }

          const existing = existingData.get(info.current);
          if (!existing) {
            // No row with this installment number yet - check amount consistency
            const existingAmounts = Array.from(existingData.values());
            if (existingAmounts.length > 0) {
              const refAmount = existingAmounts[0].amount;
              const diff = Math.abs(row.amountCents - refAmount);
              const percentDiff = diff / refAmount;

              // Different purchase if >10% AND >R$1.00 difference
              if (percentDiff > 0.10 && diff > 100) {
                suffix++;
                targetKey = `${baseKey}|${suffix}`;
                continue;
              }
            }
            break;
          }

          // Row with same installment number exists - check if it's the same purchase
          const sameAmount = existing.amount === row.amountCents;
          const sameExternalId = existing.externalId && existing.externalId === row.externalId;

          if (sameAmount && sameExternalId) {
            // Same purchase (duplicate row) - skip it entirely
            break;
          }

          if (!sameAmount || !sameExternalId) {
            // Different purchase - try next group suffix
            suffix++;
            targetKey = `${baseKey}|${suffix}`;
            continue;
          }

          break;
        }

        // Skip if duplicate row with same externalId
        const existingData = groupInstallmentData.get(targetKey);
        const existing = existingData?.get(info.current);
        if (existing?.externalId && existing.externalId === row.externalId) {
          continue;
        }
      }

      installmentGroups.get(targetKey)!.push(row);
      groupInstallmentData.get(targetKey)!.set(info.current, {
        amount: row.amountCents,
        externalId: row.externalId,
      });
    }

    // Import all new records in a transaction
    await db.transaction(async (tx) => {
      // Track transaction IDs created in this import to prevent cross-matching
      // between multiple purchases from the same store
      const newlyCreatedTransactionIds = new Set<number>();

      // Process installment groups
      for (const [, rows] of installmentGroups) {
        await processInstallmentGroup(
          tx,
          userId,
          rows,
          account[0],
          categoryOverrides,
          expenseCategoryId,
          affectedFaturas,
          newlyCreatedTransactionIds,
          faturaOverrides?.closingDate
        );
      }

      // Insert regular expenses
      if (regularExpenses.length > 0) {
        const transactionValues: Array<{
          userId: string;
          description: string;
          totalAmount: number;
          totalInstallments: number;
          categoryId: number;
          externalId?: string;
        }> = [];
        const entryMetadata: Array<{
          amountCents: number;
          purchaseDate: string;
          faturaMonth: string;
          dueDate: string;
        }> = [];

        for (const row of regularExpenses) {
          const categoryId = categoryOverrides[row.rowIndex] ?? expenseCategoryId;

          let faturaMonth: string;
          let dueDate: string;

          if (hasBillingConfig) {
            const purchaseDate = new Date(row.date + 'T00:00:00Z');

            // Use OFX closing date if provided, otherwise use account's closing day
            if (faturaOverrides?.closingDate) {
              const closingDate = new Date(faturaOverrides.closingDate + 'T00:00:00Z');
              faturaMonth = getFaturaMonthFromClosingDate(purchaseDate, closingDate);
            } else {
              faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
            }

            dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
            affectedFaturas.add(faturaMonth);
          } else {
            faturaMonth = row.date.slice(0, 7);
            dueDate = row.date;
          }

          transactionValues.push({
            userId,
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
            externalId: row.externalId,
          });

          entryMetadata.push({
            amountCents: row.amountCents,
            purchaseDate: row.date,
            faturaMonth,
            dueDate,
          });
        }

        // Bulk insert transactions
        const insertedTxs = await tx
          .insert(transactions)
          .values(transactionValues)
          .returning({ id: transactions.id });

        // Bulk insert entries
        const entryValues = insertedTxs.map((transaction, i) => ({
          userId,
          transactionId: transaction.id,
          accountId,
          amount: entryMetadata[i].amountCents,
          purchaseDate: entryMetadata[i].purchaseDate,
          faturaMonth: entryMetadata[i].faturaMonth,
          dueDate: entryMetadata[i].dueDate,
          installmentNumber: 1,
          paidAt: null,
        }));

        await tx.insert(entries).values(entryValues);
      }

      // Insert income (marked as received)
      if (newIncome.length > 0) {
        // Pre-fetch category IDs for all high-confidence refund matches
        const matchedTransactionIds = Array.from(refundMatches.values())
          .filter((match) => match.matchConfidence === 'high' && match.matchedTransactionId !== undefined)
          .map((match) => match.matchedTransactionId!)
          .filter((id): id is number => id !== undefined);

        const categoryIdMap = new Map<number, number>();
        if (matchedTransactionIds.length > 0) {
          const categoryResults = await tx
            .select({ id: transactions.id, categoryId: transactions.categoryId })
            .from(transactions)
            .where(inArray(transactions.id, matchedTransactionIds));

          for (const result of categoryResults) {
            categoryIdMap.set(result.id, result.categoryId);
          }
        }

        // Prepare income values and track refund amounts
        const incomeValues: Array<{
          userId: string;
          description: string;
          amount: number;
          categoryId: number;
          accountId: number;
          receivedDate: string;
          receivedAt: Date;
          externalId?: string;
          refundOfTransactionId?: number;
          replenishCategoryId?: number;
          faturaMonth?: string;
          isRefund: boolean;
        }> = [];
        const refundAmounts = new Map<number, number>(); // transactionId -> total refund amount

        for (const row of newIncome) {
          const categoryId = categoryOverrides[row.rowIndex] ?? incomeCategoryId;
          const matchInfo = refundMatches.get(row.rowIndex);

          const refundOfTransactionId = matchInfo?.matchConfidence === 'high' ? matchInfo.matchedTransactionId : undefined;
          const replenishCategoryId = refundOfTransactionId ? categoryIdMap.get(refundOfTransactionId) : undefined;

          // Calculate faturaMonth for credit card refunds
          let faturaMonth: string | undefined;
          if (hasBillingConfig) {
            const receivedDate = new Date(row.date + 'T00:00:00Z');

            // Use OFX closing date if provided, otherwise use account's closing day
            if (faturaOverrides?.closingDate) {
              const closingDate = new Date(faturaOverrides.closingDate + 'T00:00:00Z');
              faturaMonth = getFaturaMonthFromClosingDate(receivedDate, closingDate);
            } else {
              faturaMonth = getFaturaMonth(receivedDate, account[0].closingDay!);
            }
          }

          incomeValues.push({
            userId,
            description: row.description,
            amount: row.amountCents,
            categoryId,
            accountId,
            receivedDate: row.date,
            receivedAt: new Date(),
            externalId: row.externalId,
            refundOfTransactionId,
            replenishCategoryId,
            faturaMonth,
            isRefund: row.isRefundCandidate ?? false,
          });

          // Accumulate refund amounts
          if (refundOfTransactionId) {
            refundAmounts.set(refundOfTransactionId, (refundAmounts.get(refundOfTransactionId) || 0) + row.amountCents);
          }
        }

        // Bulk insert income
        await tx.insert(income).values(incomeValues);

        // Bulk update refunded amounts
        for (const [transactionId, refundAmount] of refundAmounts) {
          await tx
            .update(transactions)
            .set({ refundedAmount: sql`COALESCE(${transactions.refundedAmount}, 0) + ${refundAmount}` })
            .where(eq(transactions.id, transactionId));
        }
      }
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig && affectedFaturas.size > 0) {
      // Determine which fatura month the OFX represents (if any)
      // The closingDate in faturaOverrides corresponds to a specific fatura month
      // Only apply overrides to that specific month; other months use account defaults
      const ofxFaturaMonth = faturaOverrides?.closingDate?.slice(0, 7);

      // Sort faturas chronologically to process them in order
      const sortedFaturas = Array.from(affectedFaturas).sort();

      // Track the previous fatura's closing date for continuity
      let previousClosingDate: string | undefined;

      for (const month of sortedFaturas) {
        // Only apply faturaOverrides to the fatura that the OFX file represents
        let overridesForMonth: typeof faturaOverrides;

        if (month === ofxFaturaMonth) {
          // This is the OFX fatura - use provided overrides
          overridesForMonth = faturaOverrides;
          previousClosingDate = faturaOverrides?.closingDate;
        } else if (previousClosingDate) {
          // Subsequent fatura after one with custom dates
          // Set startDate to be the day after previous fatura's closing date
          const prevClosingDateObj = new Date(previousClosingDate + 'T00:00:00Z');
          prevClosingDateObj.setUTCDate(prevClosingDateObj.getUTCDate() + 1);
          const startDate = prevClosingDateObj.toISOString().split('T')[0];
          overridesForMonth = { startDate };

          // Update previousClosingDate for the next iteration
          // Compute this fatura's closing date from account defaults
          previousClosingDate = computeClosingDate(month, account[0].closingDay!);
        } else {
          // No previous custom dates - use account defaults
          overridesForMonth = undefined;
        }

        await ensureFaturaExists(accountId, month, overridesForMonth);
        await updateFaturaTotal(accountId, month);
      }

      // Batch recalculate installment dates using actual fatura windows
      await batchRecalculateInstallmentDates(accountId, sortedFaturas);
    }

    await syncAccountBalance(accountId);

    // Track category frequencies for imported records
    const frequencyItems: Array<{ description: string; categoryId: number; type: 'expense' | 'income' }> = [];

    // Add all imported expenses
    for (const row of newExpenses) {
      const categoryId = categoryOverrides[row.rowIndex] ?? expenseCategoryId;
      frequencyItems.push({
        description: row.installmentInfo?.baseDescription ?? row.description,
        categoryId,
        type: 'expense',
      });
    }

    // Add all imported income
    for (const row of newIncome) {
      const categoryId = categoryOverrides[row.rowIndex] ?? incomeCategoryId;
      frequencyItems.push({
        description: row.description,
        categoryId,
        type: 'income',
      });
    }

    if (frequencyItems.length > 0) {
      await bulkIncrementCategoryFrequency(userId, frequencyItems);
    }

    // Analytics: Track first expense and first bulk import
    const [entryCountBefore, user] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(entries).where(eq(entries.userId, userId)),
      db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
    ]);

    const totalEntriesBefore = Number(entryCountBefore[0]?.count || 0) - newExpenses.length;
    const isFirstExpense = totalEntriesBefore === 0 && newExpenses.length > 0;

    if (isFirstExpense && user[0]?.createdAt) {
      await trackFirstExpense({
        userId,
        wasImported: true,
        accountType: account[0].type,
        userCreatedAt: user[0].createdAt,
        hadCategorySuggestion: false,
      });
    }

    // Track first bulk import (5+ rows)
    const totalRows = newExpenses.length + newIncome.length;
    const hasInstallments = newExpenses.some(e => e.installmentInfo);

    if (user[0]?.createdAt) {
      await trackFirstBulkImport({
        userId,
        importType: 'mixed',
        expenseCount: newExpenses.length,
        incomeCount: newIncome.length,
        rowCount: totalRows,
        accountType: account[0].type,
        bankSource: 'other', // TODO: Detect from parser metadata
        hadDuplicates: skippedDuplicates > 0,
        installmentsDetected: hasInstallments,
        userCreatedAt: user[0].createdAt,
      });
    }

    await trackUserActivity({
      userId,
      activityType: 'create_expense',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'import_completed',
        properties: {
          import_type: 'mixed',
          expense_count: newExpenses.length,
          income_count: newIncome.length,
          skipped_duplicates: skippedDuplicates,
          account_id: accountId,
          is_credit_card: isCreditCard,
        },
      });
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/income');
    revalidatePath('/settings/accounts');

    try {
      await incrementUsageCount(userId, 'import_weekly', importWindow);
    } catch (error) {
      console.error('[import:usage] Failed to increment weekly import counter:', error);
    }

    return {
      success: true,
      importedExpenses: newExpenses.length,
      importedIncome: newIncome.length,
      skippedDuplicates,
    };
  } catch (error) {
    console.error('[import:mixed] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToImport') };
  }
}
