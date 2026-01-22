import { db } from '@/lib/db';
import { users } from '@/lib/auth-schema';
import { categories, userSettings } from '@/lib/schema';
import { DEFAULT_CATEGORIES } from './default-categories';
import { sendEmail } from '@/lib/email/send';
import { generateWelcomeHtml, generateWelcomeText } from '@/lib/email/welcome-template';
import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { eq } from 'drizzle-orm';

export interface SetupNewUserResult {
  success: boolean;
  categoriesCreated: number;
  emailSent: boolean;
  error?: string;
}

export interface SetupNewUserOptions {
  skipEmail?: boolean;
}

/**
 * Sets up a new user with default categories, user settings, and welcome email
 * Called after user creation (CLI script or future signup flow)
 */
export async function setupNewUser(
  userId: string,
  options?: SetupNewUserOptions
): Promise<SetupNewUserResult> {
  try {
    // 1. Fetch user info
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return {
        success: false,
        categoriesCreated: 0,
        emailSent: false,
        error: 'User not found',
      };
    }

    // 2. Insert default categories (batch insert)
    const categoryRecords = DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      userId,
    }));

    try {
      await db.insert(categories).values(categoryRecords);
    } catch (error) {
      console.error('[setup-new-user] Categories insert failed:', error);
      return {
        success: false,
        categoriesCreated: 0,
        emailSent: false,
        error: 'Failed to create default categories',
      };
    }

    // 3. Create user settings (timezone: America/Sao_Paulo, locale: pt-BR)
    try {
      await db.insert(userSettings).values({
        userId,
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        notificationEmail: user.email,
        notificationsEnabled: true,
        defaultEventOffsetMinutes: 60,
        defaultTaskOffsetMinutes: 60,
      });
    } catch (error) {
      console.error('[setup-new-user] User settings creation failed (non-critical):', error);
      // Non-critical - continue
    }

    // 4. Send welcome email (non-blocking, log failures)
    let emailSent = false;

    if (!options?.skipEmail) {
      const locale: Locale = 'pt-BR'; // Default for new users
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';

      const emailData = {
        userName: user.name || undefined,
        appUrl,
        locale,
      };

      const html = generateWelcomeHtml(emailData);
      const text = generateWelcomeText(emailData);
      const subject = translateWithLocale(locale, 'emails.welcome.subject');

      try {
        const result = await sendEmail({
          to: user.email,
          subject,
          html,
          text,
        });

        emailSent = result.success;

        if (!result.success) {
          console.error('[setup-new-user] Welcome email failed (non-critical):', result.error);
        }
      } catch (error) {
        console.error('[setup-new-user] Welcome email error (non-critical):', error);
      }
    }

    return {
      success: true,
      categoriesCreated: categoryRecords.length,
      emailSent,
    };
  } catch (error) {
    console.error('[setup-new-user] Unexpected error:', error);
    return {
      success: false,
      categoriesCreated: 0,
      emailSent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
