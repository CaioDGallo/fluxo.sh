'use server';

import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { fcmTokens, userSettings } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export async function registerFcmToken(token: string, deviceName?: string) {
  const userId = await getCurrentUserId();

  try {
    // Upsert token (update if exists, insert if new)
    const existingToken = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.token, token))
      .limit(1);

    if (existingToken.length > 0) {
      // Update existing token
      await db
        .update(fcmTokens)
        .set({
          userId: userId,
          deviceName,
          lastUsedAt: new Date(),
        })
        .where(eq(fcmTokens.token, token));
    } else {
      // Insert new token
      await db.insert(fcmTokens).values({
        userId: userId,
        token,
        deviceName,
      });
    }

    // Enable push notifications in user settings
    await db
      .update(userSettings)
      .set({ pushNotificationsEnabled: true })
      .where(eq(userSettings.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return { success: false, error: 'Failed to register token' };
  }
}

export async function unregisterFcmToken(token: string) {
  const userId = await getCurrentUserId();

  try {
    // Delete the token
    await db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.token, token), eq(fcmTokens.userId, userId)));

    // Check if user has any remaining tokens
    const remainingTokens = await db
      .select()
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId));

    // If no tokens left, disable push notifications
    if (remainingTokens.length === 0) {
      await db
        .update(userSettings)
        .set({ pushNotificationsEnabled: false })
        .where(eq(userSettings.userId, userId));
    }

    return { success: true };
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    return { success: false, error: 'Failed to unregister token' };
  }
}

export async function getUserDevices() {
  const userId = await getCurrentUserId();

  try {
    const devices = await db
      .select({
        id: fcmTokens.id,
        deviceName: fcmTokens.deviceName,
        createdAt: fcmTokens.createdAt,
        lastUsedAt: fcmTokens.lastUsedAt,
      })
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, userId))
      .orderBy(fcmTokens.lastUsedAt);

    return { success: true, devices };
  } catch (error) {
    console.error('Error fetching user devices:', error);
    return { success: false, error: 'Failed to fetch devices', devices: [] };
  }
}
