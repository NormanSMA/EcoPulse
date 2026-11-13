import { useCallback, useEffect, useState } from "react";
import type { Basemap } from "@/lib/mapStyles";
const STORAGE_KEY = "ecopulse-basemap";
const DEFAULT_BASEMAP: Basemap = "dark";

/**
 * Basemap del mapa (dark/light/satellite). La interfaz tiene un solo tema
 * oscuro (DS 5.0); el basemap por defecto es "dark" salvo que el usuario
 * haya elegido otro explícitamente.
 */
export function useBasemap() {
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

  const basemap: Basemap = explicitBasemap ?? DEFAULT_BASEMAP;

  return { basemap, setBasemap, isExplicit: explicitBasemap !== null };
}
