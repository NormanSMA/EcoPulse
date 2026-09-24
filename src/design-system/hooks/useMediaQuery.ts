'use client';

import { useCallback, useSyncExternalStore } from "react";

/**
 * Estado de una media query. En el servidor (y en la hidratación) devuelve
 * `false`, así que lo que dependa de ella aparece tras hidratar.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
