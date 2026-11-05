import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Call `handler` when Escape is pressed (web / hardware keyboards). No-op elsewhere. */
export function useEscape(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
