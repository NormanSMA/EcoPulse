import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Extrae el patrón fetch+estado que hoy se repite 8 veces en page.tsx.
 * Crea y limpia su propio AbortController por invocación (mismo
 * comportamiento que los useEffect actuales: cancela al desmontar o al
 * relanzar, evitando setState tras desmontaje y fetches duplicados en
 * React Strict Mode).
 */
export function useDataLayer<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const runFetch = useCallback(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchFnRef.current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLastFetch(Date.now());
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error("Unknown error"));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    return runFetch();
  }, [runFetch]);

  // API pública: dispara un nuevo fetch sin exponer el AbortController interno.
  const refetch = useCallback(() => {
    runFetch();
  }, [runFetch]);

  return { data, loading, error, refetch, lastFetch };
}
