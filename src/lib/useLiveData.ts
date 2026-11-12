'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EarthquakeGeoJSON,
  AirQualityGeoJSON,
  FireGeoJSON,
  DisasterGeoJSON,
  IssGeoJSON,
  VolcanoGeoJSON,
  ActiveVolcanoGeoJSON,
  CycloneGeoJSON,
  TectonicBoundaryGeoJSON,
  TectonicPlateGeoJSON,
} from "@/lib/types";
import type { LiveBundle, SourceResult, SourceStatus } from "@/lib/live/bundle";
import type { HazardsBundle, OrbitBundle, PulseBundle } from "@/lib/live/sources";
import { issAt } from "@/lib/iss";
import { loadSnapshot, saveSnapshot } from "@/lib/offline/liveSnapshot";

// Carga y refresco de las fuentes de la web. Los eventos llegan en lotes
// (/api/live/*) agrupados por frecuencia de cambio; cada fuente informa su
// estado y, si falla, se conserva su último dato válido.

const EMPTY = { type: "FeatureCollection", features: [] } as const;
const EMPTY_QUAKES: EarthquakeGeoJSON = {
  type: "FeatureCollection",
  metadata: { generated: 0, url: "", title: "", status: 0, api: "", count: 0 },
  features: [],
};

// La ISS se mueve en el cliente con la efeméride del lote: sin red entre ticks.
const ISS_TICK_MS = 15_000;
const ORBIT_REFRESH_MS = 5 * 60_000;
const QUAKES_REFRESH_MS = 2 * 60_000;
const SLOW_REFRESH_MS = 15 * 60_000;
const RADAR_REFRESH_MS = 5 * 60_000;
const RADAR_META = "https://api.rainviewer.com/public/weather-maps.json";

export interface RadarFrame {
  time: number;
  tiles: string;
}

export type LiveSourceKey = "earthquakes" | "fires" | "disasters" | "cyclones" | "volcanoes" | "iss";
export interface LiveSourceState {
  status: SourceStatus | "loading";
  /** Última respuesta válida de la fuente (ms epoch), o null si aún no hay. */
  fetchedAt: number | null;
}
export type LiveSourceStatus = Record<LiveSourceKey, LiveSourceState>;

const INITIAL_STATUS: LiveSourceStatus = {
  earthquakes: { status: "loading", fetchedAt: null },
  fires: { status: "loading", fetchedAt: null },
  disasters: { status: "loading", fetchedAt: null },
  cyclones: { status: "loading", fetchedAt: null },
  volcanoes: { status: "loading", fetchedAt: null },
  iss: { status: "loading", fetchedAt: null },
};

async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    // Sin red o servidor reiniciando: se reintenta en el siguiente ciclo, no es un fallo de la app.
    if (err instanceof TypeError) console.warn("Sin conexion con los datos, se reintenta:", url);
    else console.error("Error de datos:", err);
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

/**
 * Estado de cada fuente tras recibir (o no) su lote. Sin lote, todas sus
 * fuentes quedan en error; `fetchedAt` conserva la última respuesta válida.
 */
export function nextSourceStatus<S extends Record<string, unknown>>(
  previous: LiveSourceStatus,
  keys: readonly (keyof S & LiveSourceKey)[],
  bundle: LiveBundle<S> | null,
): LiveSourceStatus {
  const next = { ...previous };
  for (const key of keys) {
    const result: SourceResult<unknown> | undefined = bundle?.sources[key];
    next[key] = result && result.data !== null
      ? { status: result.status, fetchedAt: result.fetchedAt }
      : { status: result?.status ?? "error", fetchedAt: previous[key].fetchedAt };
  }
  return next;
}

const SNAPSHOT_MAX_FIRES = 3000;
interface HazardsSnapshot {
  fires: FireGeoJSON | null;
  disasters: DisasterGeoJSON | null;
  cyclones: CycloneGeoJSON | null;
  volcanoes: ActiveVolcanoGeoJSON | null;
}

const PULSE_KEYS = ["earthquakes"] as const;
const HAZARD_KEYS = ["fires", "disasters", "cyclones", "volcanoes"] as const;
const ORBIT_KEYS = ["iss"] as const;

// Las fuentes pesadas u opcionales (semana de sismos, ~7.600 estaciones de
// aire, catálogo de volcanes, radar) solo se piden con su capa activa.
export function useLiveData({
  needWeek,
  needAir,
  needCatalog,
  needRadar,
  needTectonics,
}: {
  needWeek: boolean;
  needAir: boolean;
  needCatalog: boolean;
  needRadar: boolean;
  needTectonics: boolean;
}) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(EMPTY_QUAKES);
  const [quakesStatus, setQuakesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [weekQuakes, setWeekQuakes] = useState<EarthquakeGeoJSON | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityGeoJSON>(EMPTY as unknown as AirQualityGeoJSON);
  const [fires, setFires] = useState<FireGeoJSON>(EMPTY as unknown as FireGeoJSON);
  const [disasters, setDisasters] = useState<DisasterGeoJSON>(EMPTY as unknown as DisasterGeoJSON);
  const [cyclones, setCyclones] = useState<CycloneGeoJSON>(EMPTY as unknown as CycloneGeoJSON);
  const [volcanoes, setVolcanoes] = useState<ActiveVolcanoGeoJSON>(EMPTY as unknown as ActiveVolcanoGeoJSON);
  const [volcanoCatalog, setVolcanoCatalog] = useState<VolcanoGeoJSON | null>(null);
  const [issBase, setIssBase] = useState<IssGeoJSON>(EMPTY as unknown as IssGeoJSON);
  const [issClock, setIssClock] = useState(() => Date.now());
  const [tectonics, setTectonics] = useState<{ boundaries: TectonicBoundaryGeoJSON; plates: TectonicPlateGeoJSON } | null>(null);
  const [radar, setRadar] = useState<RadarFrame[]>([]);
  const [sourceStatus, setSourceStatus] = useState<LiveSourceStatus>(INITIAL_STATUS);
  // Fecha de la foto guardada que se está mostrando (null si hay datos de red).
  const [snapshotAt, setSnapshotAt] = useState<number | null>(null);
  const hasLive = useRef({ pulse: false, hazards: false });

  const report = useCallback(
    <S extends Record<string, unknown>>(keys: readonly (keyof S & LiveSourceKey)[], bundle: LiveBundle<S> | null) =>
      setSourceStatus((previous) => nextSourceStatus(previous, keys, bundle)),
    []
  );

  usePolling(async (signal) => {
    const bundle = await getJson<PulseBundle>("/api/live/pulse", signal);
    if (signal.aborted) return;
    report(PULSE_KEYS, bundle);
    const data = bundle?.sources.earthquakes.data;
    if (data) {
      hasLive.current.pulse = true;
      setSnapshotAt(null);
      setEarthquakes(data);
      setQuakesStatus("ready");
      saveSnapshot("pulse", data);
      return;
    }
    // Sin red y sin datos aún: se muestra la última foto guardada.
    const saved = hasLive.current.pulse ? null : await loadSnapshot<EarthquakeGeoJSON>("pulse");
    if (signal.aborted) return;
    if (saved) {
      setEarthquakes(saved.data);
      setSnapshotAt(saved.savedAt);
      setQuakesStatus("ready");
    } else if (!hasLive.current.pulse) setQuakesStatus("error");
  }, QUAKES_REFRESH_MS);

  usePolling(
    async (signal) => {
      const bundle = await getJson<PulseBundle>("/api/live/pulse?period=week", signal);
      const data = bundle?.sources.earthquakes.data;
      if (data) setWeekQuakes(data);
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
    const bundle = await getJson<HazardsBundle>("/api/live/hazards", signal);
    if (signal.aborted) return;
    report(HAZARD_KEYS, bundle);
    if (!bundle) {
      if (hasLive.current.hazards) return;
      const saved = await loadSnapshot<HazardsSnapshot>("hazards");
      if (signal.aborted || !saved) return;
      if (saved.data.fires) setFires(saved.data.fires);
      if (saved.data.disasters) setDisasters(saved.data.disasters);
      if (saved.data.cyclones) setCyclones(saved.data.cyclones);
      if (saved.data.volcanoes) setVolcanoes(saved.data.volcanoes);
      setSnapshotAt((previous) => previous ?? saved.savedAt);
      return;
    }
    hasLive.current.hazards = true;
    const { fires: f, disasters: dis, cyclones: cyc, volcanoes: vol } = bundle.sources;
    if (f.data) setFires(f.data);
    if (dis.data) setDisasters(dis.data);
    if (cyc.data) setCyclones(cyc.data);
    if (vol.data) setVolcanoes(vol.data);
    // Los incendios del mundo pesan demasiado para guardarlos: solo los primeros miles.
    saveSnapshot("hazards", {
      fires: f.data && { ...f.data, features: f.data.features.slice(0, SNAPSHOT_MAX_FIRES) },
      disasters: dis.data,
      cyclones: cyc.data,
      volcanoes: vol.data,
    } satisfies HazardsSnapshot);
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
    const bundle = await getJson<OrbitBundle>("/api/live/orbit", signal);
    if (signal.aborted) return;
    report(ORBIT_KEYS, bundle);
    const data = bundle?.sources.iss.data;
    if (data) {
      setIssBase(data);
      setIssClock(Date.now());
    }
  }, ORBIT_REFRESH_MS);

  useEffect(() => {
    const id = setInterval(() => setIssClock(Date.now()), ISS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const iss = useMemo<IssGeoJSON>(
    () => (issBase.features.length ? { ...issBase, features: issBase.features.map((f) => issAt(f, issClock)) } : issBase),
    [issBase, issClock]
  );

  // Placas tectónicas (PB2002): estáticas, se cargan una vez al activar la capa.
  useEffect(() => {
    if (!needTectonics || tectonics) return;
    const controller = new AbortController();
    (async () => {
      const [boundaries, plates] = await Promise.all([
        getJson<TectonicBoundaryGeoJSON>("/data/tectonics/boundaries.json", controller.signal),
        getJson<TectonicPlateGeoJSON>("/data/tectonics/plates.json", controller.signal),
      ]);
      if (boundaries && plates) setTectonics({ boundaries, plates });
    })();
    return () => controller.abort();
  }, [needTectonics, tectonics]);

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

  return { earthquakes, quakesStatus, weekQuakes, airQuality, fires, disasters, cyclones, volcanoes, volcanoCatalog, iss, radar, tectonics, sourceStatus, snapshotAt };
}

/** Cuadro de radar más cercano (sin pasarse) al instante de referencia. */
export function radarFrameAt(frames: RadarFrame[], refTime: number): RadarFrame | null {
  if (!frames.length) return null;
  const earlier = frames.filter((f) => f.time <= refTime + 5 * 60_000);
  if (!earlier.length) return null; // el cursor está antes de la cobertura del radar
  return earlier[earlier.length - 1];
}
