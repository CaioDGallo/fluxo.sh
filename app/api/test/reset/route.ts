import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  accounts,
  budgets,
  calendarSources,
  categories,
  entries,
  events,
  faturas,
  income,
  monthlyBudgets,
  notificationJobs,
  notifications,
  recurrenceRules,
  tasks,
  transfers,
  transactions,
  userSettings,
} from '@/lib/schema';

export const dynamic = 'force-dynamic';

const isEnabled = process.env.E2E_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

export async function POST() {
  if (!isEnabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await db.delete(notificationJobs);
    await db.delete(notifications);
    await db.delete(recurrenceRules);
    await db.delete(tasks);
    await db.delete(events);
    await db.delete(calendarSources);
    await db.delete(entries);
    await db.delete(transactions);
    await db.delete(transfers);
    await db.delete(income);
    await db.delete(faturas);
    await db.delete(budgets);
    await db.delete(monthlyBudgets);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(userSettings);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[e2e-reset] Failed to reset database:', error);
    return NextResponse.json({ success: false, error: 'Failed to reset database' }, { status: 500 });
  }
}
