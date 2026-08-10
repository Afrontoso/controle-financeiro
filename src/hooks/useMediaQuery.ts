"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Assina uma media query. No servidor devolve `false`, então componentes que
 * dependem disso devem tratar o caso mobile como padrão.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
