'use client';

import { useState, useRef } from 'react';
import posthog from 'posthog-js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { joinWaitlist } from '@/lib/actions/waitlist';
import type {
  LandingWaitlistProperties,
  LandingWaitlistStartedProperties,
} from '@/lib/tracking/landing-events';

interface LandingWaitlistFormProps {
  emailLabel: string;
  emailPlaceholder: string;
  submitNote: string;
  submitButton: string;
  submittingButton: string;
  successMessage: string;
  errorDuplicate: string;
  errorRateLimit: string;
  errorInvalid: string;
  errorGeneric: string;
}

/**
 * Waitlist form with submission handling and PostHog tracking
 */
export function LandingWaitlistForm({
  emailLabel,
  emailPlaceholder,
  submitNote,
  submitButton,
  submittingButton,
  successMessage,
  errorDuplicate,
  errorRateLimit,
  errorInvalid,
  errorGeneric,
}: LandingWaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTrackedFocus, setHasTrackedFocus] = useState(false);
  const [hasTrackedStarted, setHasTrackedStarted] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const interactionStartRef = useRef<number>(0);

  const handleFocus = () => {
    if (hasTrackedFocus) return;

    const timeOnPage =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getTimeOnPage() || 0;
    const sectionsViewed =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getSectionsViewed() || [];

    const properties: LandingWaitlistProperties = {
      focus_source: timeOnPage < 5 ? 'scroll' : 'click',
      time_on_page_before_focus: timeOnPage,
      sections_viewed: sectionsViewed,
    };

    posthog.capture('landing_waitlist_focused', properties);
    setHasTrackedFocus(true);
    interactionStartRef.current = Date.now();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);

    if (hasTrackedStarted) return;

    // Debounce typing event (500ms)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      const hasValue = e.target.value.length > 0;
      const interactionTime = interactionStartRef.current
        ? (Date.now() - interactionStartRef.current) / 1000
        : 0;

      const properties: LandingWaitlistStartedProperties = {
        email_entered: hasValue,
        form_interaction_time_seconds: Math.round(interactionTime),
      };

      posthog.capture('landing_waitlist_started', properties);
      setHasTrackedStarted(true);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Get metadata from landing tracking
    const sectionsViewed =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getSectionsViewed() || [];
    const timeOnPage =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getTimeOnPage() || 0;

    const result = await joinWaitlist({
      email,
      metadata: {
        sections_viewed: sectionsViewed,
        time_on_page: timeOnPage,
      },
    });

    setIsSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      setEmail('');
    } else {
      // Map error codes to user-friendly messages
      switch (result.code) {
        case 'DUPLICATE':
          setError(errorDuplicate);
          break;
        case 'RATE_LIMITED':
          setError(errorRateLimit);
          break;
        case 'INVALID_EMAIL':
          setError(errorInvalid);
          break;
        default:
          setError(errorGeneric);
      }
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            {successMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label
        className="text-xs font-semibold uppercase tracking-[0.2em]"
        htmlFor="waitlist-email"
      >
        {emailLabel}
      </label>
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-2">
          <Input
            id="waitlist-email"
            type="email"
            placeholder={emailPlaceholder}
            value={email}
            onFocus={handleFocus}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <Button
          type="submit"
          variant="popout"
          className="w-full"
          disabled={isSubmitting || !email}
        >
          {isSubmitting ? submittingButton : submitButton}
        </Button>
      </div>
      <p className="text-xs text-foreground/80">{submitNote}</p>
    </form>
  );
}
