'use server';

import { db } from '@/lib/db';
import { entries, transactions, categories, accounts, income } from '@/lib/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { trackExport } from '@/lib/analytics';
import { users } from '@/lib/auth-schema';
import { t } from '@/lib/i18n/server-errors';
import { getUserEntitlements } from '@/lib/plan-entitlements';
import { getUsageCount, getUserTimezone, getWeeklyWindow, incrementUsageCount } from '@/lib/plan-usage';
import { checkBulkRateLimit } from '@/lib/rate-limit';

export type TimeRange = 'month' | 'year' | 'all';

const EXPORT_VOLUME_LIMITS: Record<TimeRange, number> = {
  month: 5000,
  year: 20000,
  all: 50000,
};

export type ExportEntry = {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  categoryName: string;
  accountName: string;
  amount: number; // cents
  type: 'expense' | 'income';
  status: 'paid' | 'pending';
  installment: string | null; // "1/3" or null
  transactionId: number;
  ignored: boolean;
};

/**
 * Fetch expenses and income for export
 */
export async function getTransactionsForExport(
  timeRange: TimeRange,
  yearMonth?: string,
  includeExpenses: boolean = true,
  includeIncome: boolean = true
): Promise<ExportEntry[]> {
  const userId = await getCurrentUserId();
  const results: ExportEntry[] = [];

  if (!includeExpenses && !includeIncome) {
    return results;
  }

  // Build date filter conditions
  let dateFilter: { gte: string; lte: string } | undefined = undefined;
  if (timeRange === 'month' && yearMonth) {
    const year = yearMonth.substring(0, 4);
    const month = yearMonth.substring(5, 7);
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
    dateFilter = { gte: startDate, lte: endDate };
  } else if (timeRange === 'year' && yearMonth) {
    const year = yearMonth.substring(0, 4);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    dateFilter = { gte: startDate, lte: endDate };
  }

  const [entitlements, timezone] = await Promise.all([
    getUserEntitlements(userId),
    getUserTimezone(userId),
  ]);

  const exportWindow = getWeeklyWindow(timezone);
  const exportCount = await getUsageCount(userId, 'export_weekly', exportWindow);
  if (exportCount >= entitlements.limits.importWeekly) {
    throw new Error(await t('errors.exportLimitReached', { limit: entitlements.limits.importWeekly }));
  }

  const rateLimit = await checkBulkRateLimit(userId);
  if (!rateLimit.allowed) {
    throw new Error(await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }));
  }

  const [expenseCountResult, incomeCountResult] = await Promise.all([
    includeExpenses
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(entries)
          .innerJoin(transactions, eq(entries.transactionId, transactions.id))
          .where(
            and(
              eq(entries.userId, userId),
              eq(transactions.ignored, false),
              dateFilter
                ? and(
                    gte(entries.purchaseDate, dateFilter.gte),
                    lte(entries.purchaseDate, dateFilter.lte)
                  )
                : undefined
            )
          )
      : Promise.resolve([{ count: 0 }]),
    includeIncome
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(income)
          .where(
            and(
              eq(income.userId, userId),
              eq(income.ignored, false),
              dateFilter
                ? and(
                    gte(income.receivedDate, dateFilter.gte),
                    lte(income.receivedDate, dateFilter.lte)
                  )
                : undefined
            )
          )
      : Promise.resolve([{ count: 0 }]),
  ]);

  const expenseCount = Number(expenseCountResult?.[0]?.count ?? 0);
  const incomeCount = Number(incomeCountResult?.[0]?.count ?? 0);
  const totalCount = expenseCount + incomeCount;

  const volumeLimit = EXPORT_VOLUME_LIMITS[timeRange];
  if (totalCount > volumeLimit) {
    throw new Error(await t('errors.exportVolumeLimitReached', { limit: volumeLimit }));
  }

  await incrementUsageCount(userId, 'export_weekly', exportWindow);

  // Fetch expenses (entries)
  if (includeExpenses) {
    const expensesQuery = db
      .select({
        entryId: entries.id,
        purchaseDate: entries.purchaseDate,
        amount: entries.amount,
        paidAt: entries.paidAt,
        installmentNumber: entries.installmentNumber,
        transactionId: transactions.id,
        description: transactions.description,
        totalInstallments: transactions.totalInstallments,
        ignored: transactions.ignored,
        categoryName: categories.name,
        accountName: accounts.name,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(
        and(
          eq(entries.userId, userId),
          eq(transactions.ignored, false),
          dateFilter
            ? and(
                gte(entries.purchaseDate, dateFilter.gte),
                lte(entries.purchaseDate, dateFilter.lte)
              )
            : undefined
        )
      )
      .orderBy(entries.purchaseDate);

    const expenses = await expensesQuery;

    for (const exp of expenses) {
      results.push({
        id: exp.entryId,
        date: exp.purchaseDate,
        description: exp.description || 'Despesa',
        categoryName: exp.categoryName,
        accountName: exp.accountName,
        amount: exp.amount,
        type: 'expense',
        status: exp.paidAt ? 'paid' : 'pending',
        installment:
          exp.totalInstallments > 1
            ? `${exp.installmentNumber}/${exp.totalInstallments}`
            : null,
        transactionId: exp.transactionId,
        ignored: exp.ignored,
      });
    }
  }

  // Fetch income
  if (includeIncome) {
    const incomeQuery = db
      .select({
        incomeId: income.id,
        receivedDate: income.receivedDate,
        amount: income.amount,
        receivedAt: income.receivedAt,
        description: income.description,
        ignored: income.ignored,
        categoryName: categories.name,
        accountName: accounts.name,
      })
      .from(income)
      .innerJoin(categories, eq(income.categoryId, categories.id))
      .innerJoin(accounts, eq(income.accountId, accounts.id))
      .where(
        and(
          eq(income.userId, userId),
          eq(income.ignored, false),
          dateFilter
            ? and(
                gte(income.receivedDate, dateFilter.gte),
                lte(income.receivedDate, dateFilter.lte)
              )
            : undefined
        )
      )
      .orderBy(income.receivedDate);

    const incomes = await incomeQuery;

    for (const inc of incomes) {
      results.push({
        id: inc.incomeId,
        date: inc.receivedDate,
        description: inc.description || 'Receita',
        categoryName: inc.categoryName,
        accountName: inc.accountName,
        amount: inc.amount,
        type: 'income',
        status: inc.receivedAt ? 'paid' : 'pending',
        installment: null,
        transactionId: inc.incomeId,
        ignored: inc.ignored,
      });
    }
  }

  // Sort by date
  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}

/**
 * Track data export event
 */
export async function trackDataExport(params: {
  timeRange: TimeRange;
  includeExpenses: boolean;
  includeIncome: boolean;
  recordCount: number;
}) {
  try {
    const userId = await getCurrentUserId();

    // Get user creation date
    const [user] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.createdAt) {
      return; // Can't track without user creation date
    }

    // Check if this is the first export
    const [userSettings] = await db.query.userSettings.findMany({
      where: (settings, { eq }) => eq(settings.userId, userId),
      limit: 1,
    });

    const isFirstExport = !userSettings?.firstExportCompletedAt;

    await trackExport({
      userId,
      exportFormat: 'csv',
      timeRange: params.timeRange,
      includeExpenses: params.includeExpenses,
      includeIncome: params.includeIncome,
      recordCount: params.recordCount,
      userCreatedAt: user.createdAt,
      isFirstExport,
    });
  } catch (error) {
    console.error('Failed to track export:', error);
    // Don't throw - analytics should never break user flows
  }
}
