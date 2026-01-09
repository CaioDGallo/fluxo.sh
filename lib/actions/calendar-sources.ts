'use server';

import { db } from '@/lib/db';
import { calendarSources, type NewCalendarSource } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { logError } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

type ActionResult<T = { id: number }> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function getCalendarSources() {
  try {
    const userId = await getCurrentUserId();
    return await db
      .select()
      .from(calendarSources)
      .where(eq(calendarSources.userId, userId))
      .orderBy(calendarSources.name);
  } catch (error) {
    logError(ErrorIds.DB_READ_FAILED, 'Failed to get calendar sources', error);
    return [];
  }
}

export async function getCalendarSourceById(id: number) {
  try {
    const userId = await getCurrentUserId();
    const [source] = await db
      .select()
      .from(calendarSources)
      .where(and(eq(calendarSources.id, id), eq(calendarSources.userId, userId)))
      .limit(1);
    return source;
  } catch (error) {
    logError(ErrorIds.DB_READ_FAILED, 'Failed to get calendar source', error, { id });
    return undefined;
  }
}

export async function createCalendarSource(
  data: Omit<NewCalendarSource, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Validate URL format
    try {
      new URL(data.url);
    } catch {
      return { success: false, error: await t('errors.invalidUrl') };
    }

    const [source] = await db
      .insert(calendarSources)
      .values({ ...data, userId })
      .returning();

    revalidatePath('/settings/calendars');
    revalidateTag('calendar-sources', 'default');
    return { success: true, data: { id: source.id } };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SOURCE_CREATE_FAILED, 'Failed to create calendar source', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateCalendarSource(
  id: number,
  data: Partial<Omit<NewCalendarSource, 'id' | 'userId' | 'createdAt'>>
): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    const [existing] = await db
      .select()
      .from(calendarSources)
      .where(and(eq(calendarSources.id, id), eq(calendarSources.userId, userId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: await t('errors.notFound') };
    }

    if (data.url) {
      try {
        new URL(data.url);
      } catch {
        return { success: false, error: await t('errors.invalidUrl') };
      }
    }

    await db
      .update(calendarSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(calendarSources.id, id));

    revalidatePath('/settings/calendars');
    revalidateTag('calendar-sources', 'default');
    return { success: true };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SOURCE_UPDATE_FAILED, 'Failed to update calendar source', error, { id });
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteCalendarSource(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Events are cascade deleted via FK
    await db
      .delete(calendarSources)
      .where(and(eq(calendarSources.id, id), eq(calendarSources.userId, userId)));

    revalidatePath('/settings/calendars');
    revalidatePath('/calendar');
    revalidateTag('calendar-sources', 'default');
    revalidateTag('events', 'default');
    return { success: true };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SOURCE_DELETE_FAILED, 'Failed to delete calendar source', error, { id });
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}
