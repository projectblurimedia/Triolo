import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * A payment opens in the browser; when the person comes back to the app, `check` runs once
 * so a paid plan / badge / boost shows without any extra tap. Call `watch(check)` right
 * before opening the payment page.
 */
export function usePaymentReturn() {
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && pending.current) {
        const run = pending.current;
        pending.current = null;
        run();
      }
    });
    return () => subscription.remove();
  }, []);
  return {
    watch: (check: () => void) => {
      pending.current = check;
    },
  };
}
