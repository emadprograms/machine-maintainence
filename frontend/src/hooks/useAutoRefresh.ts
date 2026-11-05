import { useState, useEffect, useRef } from 'react';

export function useAutoRefresh<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 15000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, intervalMs);
    return () => { clearInterval(intervalRef.current); };
  }, []);

  async function load() {
    try { setData(await fetcher()); }
    catch {}
    finally { setLoading(false); }
  }

  return { data, loading };
}
