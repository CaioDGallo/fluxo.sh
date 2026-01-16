import { useEffect, useRef, useCallback, useState } from 'react';

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<void>;
  threshold?: number; // pixels to trigger refresh, default 80
  disabled?: boolean;
};

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const scrollableRef = useRef<HTMLElement | null>(null);
  const gestureLocked = useRef<'vertical' | 'horizontal' | null>(null);
  const lockThreshold = 10; // px to determine gesture direction

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;

    const scrollable = scrollableRef.current || document.scrollingElement;
    if (!scrollable) return;

    // Only trigger if at top of scroll
    if (scrollable.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      gestureLocked.current = null;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || startYRef.current === null || startXRef.current === null) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // Determine gesture direction if not yet locked
    if (gestureLocked.current === null) {
      const absY = Math.abs(deltaY);
      const absX = Math.abs(deltaX);

      if (absY >= lockThreshold || absX >= lockThreshold) {
        // Lock direction based on which axis has more movement
        if (absX > absY) {
          gestureLocked.current = 'horizontal';
          // Cancel pull-to-refresh for horizontal gestures (swipe-to-delete)
          startYRef.current = null;
          startXRef.current = null;
          return;
        } else {
          gestureLocked.current = 'vertical';
        }
      } else {
        // Not enough movement yet to determine direction
        return;
      }
    }

    // Only continue if locked to vertical gesture
    if (gestureLocked.current !== 'vertical') return;

    const distance = Math.max(0, deltaY);

    if (distance > 0) {
      setPullDistance(distance);
      // Prevent default scroll when pulling down
      e.preventDefault();
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;

    const wasVerticalGesture = gestureLocked.current === 'vertical';
    const currentPullDistance = pullDistance;

    // Reset gesture state
    startYRef.current = null;
    startXRef.current = null;
    gestureLocked.current = null;

    if (!wasVerticalGesture) return;

    if (currentPullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (disabled) return;

    const options: AddEventListenerOptions = { passive: false };

    window.addEventListener('touchstart', handleTouchStart, options);
    window.addEventListener('touchmove', handleTouchMove, options);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  return {
    isRefreshing,
    pullDistance,
    setScrollableRef: (ref: HTMLElement | null) => {
      scrollableRef.current = ref;
    },
  };
}
