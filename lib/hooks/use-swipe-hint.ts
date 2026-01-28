import { useEffect, useRef, useState } from 'react';

type UseSwipeHintOptions = {
  enabled: boolean;
  distance?: number;
  delayMs?: number;
  holdMs?: number;
  settleMs?: number;
};

const SWIPE_HINT_STORAGE_KEY = 'swipe-hint-shown';
let swipeHintInProgress = false;

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function useSwipeHint({
  enabled,
  distance = -20,
  delayMs = 420,
  holdMs = 360,
  settleMs = 280,
}: UseSwipeHintOptions) {
  const [offset, setOffset] = useState(0);
  const [isHinting, setIsHinting] = useState(false);
  const timeoutsRef = useRef<{ start?: number; hold?: number; settle?: number }>({});

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;

    const storage = window.sessionStorage;
    if (storage.getItem(SWIPE_HINT_STORAGE_KEY) === '1') return;
    if (swipeHintInProgress) return;

    swipeHintInProgress = true;

    const startId = window.setTimeout(() => {
      setIsHinting(true);
      setOffset(distance);

      const holdId = window.setTimeout(() => {
        setOffset(0);

        const settleId = window.setTimeout(() => {
          storage.setItem(SWIPE_HINT_STORAGE_KEY, '1');
          swipeHintInProgress = false;
          setIsHinting(false);
        }, settleMs);

        timeoutsRef.current.settle = settleId;
      }, holdMs);

      timeoutsRef.current.hold = holdId;
    }, delayMs);

    timeoutsRef.current.start = startId;

    return () => {
      if (timeoutsRef.current.start) window.clearTimeout(timeoutsRef.current.start);
      if (timeoutsRef.current.hold) window.clearTimeout(timeoutsRef.current.hold);
      if (timeoutsRef.current.settle) window.clearTimeout(timeoutsRef.current.settle);
      timeoutsRef.current = {};
      if (storage.getItem(SWIPE_HINT_STORAGE_KEY) !== '1') {
        swipeHintInProgress = false;
      }
      setOffset(0);
      setIsHinting(false);
    };
  }, [enabled, distance, delayMs, holdMs, settleMs]);

  return { hintOffset: offset, isHinting };
}
