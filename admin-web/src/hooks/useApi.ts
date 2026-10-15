import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data and re-loads when `deps` change. `reload()` refreshes in the background (the
 * old data stays on screen); a stale response from an earlier request is dropped.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const run = useCallback(
    async (background: boolean) => {
      const id = ++requestId.current;
      if (!background) setLoading(true);
      try {
        const result = await load();
        if (id === requestId.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    run(false);
  }, [run]);

  return { data, error, loading, reload: () => run(true), setData };
}
