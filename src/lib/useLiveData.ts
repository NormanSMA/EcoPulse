'use client';

import { useEffect, useState } from "react";
import type {
  EarthquakeGeoJSON,
  AirQualityGeoJSON,
  FireGeoJSON,
  DisasterGeoJSON,
  IssGeoJSON,
  VolcanoGeoJSON,
  ActiveVolcanoGeoJSON,
  CycloneGeoJSON,
} from "@/lib/types";

// Carga y refresco de todas las fuentes de la web (vía las rutas /api/*,
// que cachean en el CDN). Cada fuente falla por separado sin romper las demás.

const EMPTY = { type: "FeatureCollection", features: [] } as const;
const EMPTY_QUAKES: EarthquakeGeoJSON = {
  type: "FeatureCollection",
  metadata: { generated: 0, url: "", title: "", status: 0, api: "", count: 0 },
  features: [],
};

const ISS_REFRESH_MS = 15_000;
const QUAKES_REFRESH_MS = 2 * 60_000;
const SLOW_REFRESH_MS = 15 * 60_000;
const RADAR_REFRESH_MS = 5 * 60_000;
const RADAR_META = "https://api.rainviewer.com/public/weather-maps.json";

export interface RadarFrame {
  time: number;
  tiles: string;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) console.error("Error de datos:", err);
    return null;
  }
}

/** Ejecuta `load` al montar y cada `everyMs`, abortando al desmontar. */
function usePolling(load: (signal: AbortSignal) => Promise<void>, everyMs: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal);
    const id = setInterval(() => load(controller.signal), everyMs);
    return () => {
      controller.abort();
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, enabled]);
}

// Las fuentes pesadas u opcionales (semana de sismos, ~7.600 estaciones de
// aire, catálogo de volcanes, radar) solo se piden con su capa activa.
export function useLiveData({
  needWeek,
  needAir,
  needCatalog,
  needRadar,
}: {
  needWeek: boolean;
  needAir: boolean;
  needCatalog: boolean;
  needRadar: boolean;
}) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(EMPTY_QUAKES);
  const [weekQuakes, setWeekQuakes] = useState<EarthquakeGeoJSON | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityGeoJSON>(EMPTY as unknown as AirQualityGeoJSON);
  const [fires, setFires] = useState<FireGeoJSON>(EMPTY as unknown as FireGeoJSON);
  const [disasters, setDisasters] = useState<DisasterGeoJSON>(EMPTY as unknown as DisasterGeoJSON);
  const [cyclones, setCyclones] = useState<CycloneGeoJSON>(EMPTY as unknown as CycloneGeoJSON);
  const [volcanoes, setVolcanoes] = useState<ActiveVolcanoGeoJSON>(EMPTY as unknown as ActiveVolcanoGeoJSON);
  const [volcanoCatalog, setVolcanoCatalog] = useState<VolcanoGeoJSON | null>(null);
  const [iss, setIss] = useState<IssGeoJSON>(EMPTY as unknown as IssGeoJSON);
  const [radar, setRadar] = useState<RadarFrame[]>([]);

  usePolling(async (signal) => {
    const d = await getJson<EarthquakeGeoJSON>("/api/earthquakes", signal);
    if (d) setEarthquakes(d);
  }, QUAKES_REFRESH_MS);

  usePolling(
    async (signal) => {
      const d = await getJson<EarthquakeGeoJSON>("/api/earthquakes?period=week", signal);
      if (d) setWeekQuakes(d);
    },
    SLOW_REFRESH_MS,
    needWeek
  );

  usePolling(
    async (signal) => {
      const d = await getJson<AirQualityGeoJSON>("/api/air-quality", signal);
      if (d) setAirQuality(d);
    },
    SLOW_REFRESH_MS,
    needAir
  );

  usePolling(async (signal) => {
    const [f, dis, cyc, vol] = await Promise.all([
      getJson<FireGeoJSON>("/api/fires", signal),
      getJson<DisasterGeoJSON>("/api/disasters", signal),
      getJson<CycloneGeoJSON>("/api/cyclones", signal),
      getJson<ActiveVolcanoGeoJSON>("/api/volcanoes", signal),
    ]);
    if (f) setFires(f);
    if (dis) setDisasters(dis);
    if (cyc) setCyclones(cyc);
    if (vol) setVolcanoes(vol);
  }, SLOW_REFRESH_MS);

  usePolling(
    async (signal) => {
      const d = await getJson<VolcanoGeoJSON>("/api/volcanoes?catalog=1", signal);
      if (d) setVolcanoCatalog(d);
    },
    24 * 3_600_000,
    needCatalog
  );

  usePolling(async (signal) => {
    const d = await getJson<IssGeoJSON>("/api/iss", signal);
    if (d) setIss(d);
  }, ISS_REFRESH_MS);

  // Radar de lluvia (RainViewer): últimos ~2 h en cuadros de 10 min.
  usePolling(
    async (signal) => {
      const d = await getJson<{ host: string; radar: { past: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] } }>(
        RADAR_META,
        signal
      );
      if (!d) return;
      const frames = [...d.radar.past, ...(d.radar.nowcast ?? [])];
      setRadar(frames.map((f) => ({ time: f.time * 1000, tiles: `${d.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png` })));
    },
    RADAR_REFRESH_MS,
    needRadar
  );

  return { earthquakes, weekQuakes, airQuality, fires, disasters, cyclones, volcanoes, volcanoCatalog, iss, radar };
}

/** Cuadro de radar más cercano (sin pasarse) al instante de referencia. */
export function radarFrameAt(frames: RadarFrame[], refTime: number): RadarFrame | null {
  if (!frames.length) return null;
  const earlier = frames.filter((f) => f.time <= refTime + 5 * 60_000);
  if (!earlier.length) return null; // el cursor está antes de la cobertura del radar
  return earlier[earlier.length - 1];
}
