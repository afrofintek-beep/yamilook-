import { useCallback, useRef, useState, useEffect } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
}

export function useLongPress({ onLongPress, onClick, delay = 500 }: UseLongPressOptions) {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if ('button' in event && event.button !== 0) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const point = 'touches' in event ? event.touches[0] : event;
    originRef.current = point ? { x: point.clientX, y: point.clientY } : null;
    isLongPressRef.current = false;
    setIsPressed(true);
    
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
      setIsPressed(false);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (shouldTriggerClick && !isLongPressRef.current && onClick) {
      onClick();
    }
    
    setIsPressed(false);
  }, [onClick]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPressed(false);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  const move = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in event ? event.touches[0] : event;
    if (originRef.current && point && Math.hypot(point.clientX - originRef.current.x, point.clientY - originRef.current.y) > 10) {
      cancel();
    }
  }, [cancel]);
  const wasLongPress = useCallback(() => {
    const pressed = isLongPressRef.current;
    isLongPressRef.current = false;
    return pressed;
  }, []);
  return {
    isPressed,
    cancel,
    wasLongPress,
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: move,
      onTouchCancel: cancel,
      onMouseDown: start,
      onMouseUp: clear,
      onMouseMove: move,
      onMouseLeave: cancel,
    },
  };
}
