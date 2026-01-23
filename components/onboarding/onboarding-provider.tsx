'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getOnboardingStatus, markHintViewed as markHintViewedAction } from '@/lib/actions/onboarding';

interface OnboardingContextValue {
  wizardStatus: 'loading' | 'pending' | 'in_progress' | 'completed';
  currentStep: number;
  hintsViewed: Set<string>;
  needsOnboarding: boolean;
  lastCreatedCategoryId: number | null;

  // Actions
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  startWizard: () => void;
  closeWizard: () => void;
  isHintViewed: (key: string) => boolean;
  markHintViewed: (key: string) => Promise<void>;
  setLastCreatedCategoryId: (id: number | null) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [wizardStatus, setWizardStatus] = useState<'loading' | 'pending' | 'in_progress' | 'completed'>('loading');
  const [currentStep, setCurrentStep] = useState(0);

  // Initialize hintsViewed from localStorage for instant PWA persistence
  const [hintsViewed, setHintsViewed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set();
    }
    const cachedHints = localStorage.getItem('onboarding-hints-viewed');
    if (cachedHints) {
      try {
        return new Set(JSON.parse(cachedHints));
      } catch (e) {
        console.error('Failed to parse cached hints:', e);
        return new Set();
      }
    }
    return new Set();
  });

  // Initialize lastCreatedCategoryId from localStorage
  const [lastCreatedCategoryId, setLastCreatedCategoryIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const cachedId = localStorage.getItem('onboarding-last-category');
    if (cachedId) {
      try {
        return parseInt(cachedId, 10);
      } catch (e) {
        console.error('Failed to parse cached category ID:', e);
        return null;
      }
    }
    return null;
  });

  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Load onboarding status on mount
  useEffect(() => {
    // Fetch from DB to sync with authoritative source
    getOnboardingStatus().then((status) => {
      setNeedsOnboarding(status.needsOnboarding);
      const dbHints = new Set(status.hintsViewed);
      setHintsViewed(dbHints);

      // Update localStorage with DB truth
      localStorage.setItem('onboarding-hints-viewed', JSON.stringify(status.hintsViewed));

      // Check localStorage for current step
      const savedStep = localStorage.getItem('onboarding-step');
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }

      // Check localStorage for wizard status
      const savedStatus = localStorage.getItem('onboarding-wizard-status');
      if (savedStatus === 'in_progress') {
        setWizardStatus('in_progress');
      } else if (status.needsOnboarding) {
        setWizardStatus('pending');
      } else {
        setWizardStatus('completed');
      }
    });
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      localStorage.setItem('onboarding-step', next.toString());
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem('onboarding-step', next.toString());
      return next;
    });
  }, []);

  const setStep = useCallback((step: number) => {
    setCurrentStep(step);
    localStorage.setItem('onboarding-step', step.toString());
  }, []);

  const startWizard = useCallback(() => {
    setWizardStatus('in_progress');
    setCurrentStep(0);
    localStorage.setItem('onboarding-wizard-status', 'in_progress');
    localStorage.setItem('onboarding-step', '0');
  }, []);

  const closeWizard = useCallback(() => {
    setWizardStatus('completed');
    setNeedsOnboarding(false);
    localStorage.removeItem('onboarding-wizard-status');
    localStorage.removeItem('onboarding-step');
    localStorage.removeItem('onboarding-last-category');
  }, []);

  const setLastCreatedCategoryId = useCallback((id: number | null) => {
    setLastCreatedCategoryIdState(id);
    if (id !== null) {
      localStorage.setItem('onboarding-last-category', id.toString());
    } else {
      localStorage.removeItem('onboarding-last-category');
    }
  }, []);

  const isHintViewed = useCallback((key: string) => {
    return hintsViewed.has(key);
  }, [hintsViewed]);

  const markHintViewed = useCallback(async (key: string) => {
    if (!hintsViewed.has(key)) {
      const newHints = new Set([...hintsViewed, key]);
      setHintsViewed(newHints);

      // Optimistic localStorage update for PWA persistence
      localStorage.setItem('onboarding-hints-viewed', JSON.stringify([...newHints]));

      // Persist to DB
      await markHintViewedAction(key);
    }
  }, [hintsViewed]);

  const value: OnboardingContextValue = {
    wizardStatus,
    currentStep,
    hintsViewed,
    needsOnboarding,
    lastCreatedCategoryId,
    nextStep,
    prevStep,
    setStep,
    startWizard,
    closeWizard,
    isHintViewed,
    markHintViewed,
    setLastCreatedCategoryId,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
