import { useCallback, useRef } from 'react';

type UseLongPressOptions = {
  onLongPress: () => void;
  onTap?: () => void;
  threshold?: number; // milliseconds, default 500
  disabled?: boolean;
};

export function useLongPress({
  onLongPress,
  onTap,
  threshold = 500,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    if (disabled) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();

      // Haptic feedback if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, threshold);
  }, [onLongPress, threshold, disabled]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const end = useCallback(() => {
    cancel();
    // If not long press, treat as tap
    if (!isLongPressRef.current && onTap) {
      onTap();
    }
  }, [cancel, onTap]);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: cancel,
  };
}
