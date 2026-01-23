'use server';

import { getSession } from '@/lib/auth';
import { getPostHogClient } from '@/lib/posthog-server';

export interface SubmitFeedbackInput {
  type: 'bug' | 'suggestion' | 'other';
  message: string;
  currentPage: string;
  userAgent: string;
}

export interface SubmitFeedbackResult {
  success: boolean;
  error?: string;
}

export async function submitFeedback(
  input: SubmitFeedbackInput
): Promise<SubmitFeedbackResult> {
  try {
    const session = await getSession();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const posthog = getPostHogClient();

    // Capture feedback event in PostHog
    if (posthog) {
      posthog.capture({
        distinctId: session.user.id,
        event: 'feedback_submitted',
        properties: {
          feedback_type: input.type,
          feedback_message: input.message,
          current_page: input.currentPage,
          user_agent: input.userAgent,
          user_email: session.user.email,
          timestamp: new Date().toISOString(),
        },
      });

      // Flush immediately to ensure event is captured
      await posthog.flush();
    }

    return { success: true };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
