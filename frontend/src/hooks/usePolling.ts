import { useEffect, useRef, useCallback, useState } from "react";

/**
 * Hook for efficient polling. Used by KDS and Waiter pages.
 * - Starts immediately on mount
 * - Cleans up on unmount
 * - Pauses when tab is hidden (saves battery on tablets)
 * - Configurable interval (default 5s)
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  opts: { interval?: number; enabled?: boolean } = {}
) {
  const { interval = 5000, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const poll = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    setLoading(true);
    return poll();
  }, [poll]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    poll();

    // Start interval
    timerRef.current = setInterval(poll, interval);

    // Pause when tab hidden
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        poll(); // Fetch immediately when tab becomes visible
        timerRef.current = setInterval(poll, interval);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll, interval, enabled]);

  return { data, error, loading, refresh };
}
