import { useCallback, useEffect, useState } from "react";
import type { Basemap } from "@/lib/mapStyles";
import type { Theme } from "./useTheme";

const STORAGE_KEY = "ecopulse-basemap";

/**
 * Basemap del mapa 2D (dark/light/satellite). Por defecto sigue al tema de
 * la app (dark theme -> basemap dark, light theme -> basemap light), igual
 * que `useTheme`, salvo que el usuario haya elegido explícitamente un
 * basemap (incluyendo "satellite", que no tiene equivalente de tema): en
 * ese caso se respeta la elección y no se sobreescribe al alternar el tema.
 */
export function useBasemap(theme: Theme) {
  const [explicitBasemap, setExplicitBasemapState] = useState<Basemap | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage puede fallar en modo privado o con cookies bloqueadas;
      // se degrada a auto-follow del tema sin romper la app.
    }
    if (stored === "dark" || stored === "light" || stored === "satellite") {
      setExplicitBasemapState(stored);
    }
  }, []);

  const setBasemap = useCallback((next: Basemap) => {
    setExplicitBasemapState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ver comentario de arriba.
    }
  }, []);

  const basemap: Basemap = explicitBasemap ?? theme;

  return { basemap, setBasemap, isExplicit: explicitBasemap !== null };
}
