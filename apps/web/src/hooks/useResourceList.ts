import { useEffect, useState } from 'react';

export interface ResourceList<T> {
  data: T[];
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Drives a list page's load lifecycle: run the loader on mount and on every
 * refresh, capturing the [data, error] tuple it resolves to. The loader owns
 * its own error handling and returns the tuple rather than throwing; loading
 * is only ever cleared (it is not re-raised on refresh) so the spinner shows
 * for the initial load only.
 */
export function useResourceList<T>(loader: () => Promise<[T[], string | null]>): ResourceList<T> {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    void loader().then(([nextData, nextError]) => {
      setData(nextData);
      setError(nextError);
      setLoading(false);
    });
    // Re-run only when refresh() is called, mirroring the original
    // refreshCount-driven effect; the loader identity is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount]);

  const refresh = () => setRefreshCount((count) => count + 1);

  return { data, error, loading, refresh };
}
