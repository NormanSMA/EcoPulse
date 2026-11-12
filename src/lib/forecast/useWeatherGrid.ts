'use client';

import { useEffect, useState } from "react";
import type { GridForecast } from "./types";
import type { ZoneSpec } from "../zones/types";

interface GridState {
  zoneId: string | null;
  grid: GridForecast | null;
  status: "idle" | "loading" | "ready" | "error";
}

const IDLE: GridState = { zoneId: null, grid: null, status: "idle" };

/**
 * Pronóstico de la malla de una zona para las capas de clima. Con `zone`
 * null (capas apagadas, sin red o zona guardada en pantalla) no pide nada.
 * Mientras llega la zona nueva se conserva la anterior.
 */
export function useWeatherGrid(zone: ZoneSpec | null): GridState {
  const [state, setState] = useState<GridState>(IDLE);
  const zoneId = zone?.id ?? null;

  useEffect(() => {
    if (!zoneId) return;
    const controller = new AbortController();
    setState((previous) => (previous.zoneId === zoneId && previous.status === "ready" ? previous : { ...previous, status: "loading" }));
    (async () => {
      try {
        const response = await fetch(`/api/forecast/grid?zone=${encodeURIComponent(zoneId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`grid HTTP ${response.status}`);
        const body: { forecast: GridForecast } = await response.json();
        if (!controller.signal.aborted) setState({ zoneId, grid: body.forecast, status: "ready" });
      } catch {
        if (!controller.signal.aborted) setState((previous) => ({ ...previous, status: "error" }));
      }
    })();
    return () => controller.abort();
  }, [zoneId]);

  return zoneId ? state : IDLE;
}
