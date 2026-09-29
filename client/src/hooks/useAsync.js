import { useCallback, useEffect, useRef, useState } from 'react';

/** Data hook with loading/error handling and abort on dependency change. */
export function useAsync(fetcher, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  const run = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ref.current(signal);
      if (!signal || !signal.aborted) setData(result);
      return result;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      setError(err);
      return null;
    } finally {
      if (!signal || !signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => run(), setData };
}
