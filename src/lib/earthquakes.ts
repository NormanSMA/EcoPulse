import { haversineKm, kmToDeg } from "./geo";
import { withTimeout } from "./http";
import type { EarthquakeFeature, EarthquakeGeoJSON } from "./types";

// Catálogo sísmico combinado: USGS (referencia mundial, con PAGER, tsunami y
// reportes "¿Lo sentiste?") + EMSC (red europea, mucho mejor cobertura de
// sismos moderados fuera de EE. UU.). Los duplicados se resuelven a favor
// de USGS, que trae más metadatos.

export type QuakePeriod = "day" | "week";

const USGS_FEEDS: Record<QuakePeriod, string> = {
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
};
const EMSC_FDSN = "https://www.seismicportal.eu/fdsnws/event/1/query";
const USGS_FDSN = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const EMSC_MIN_MAG = 2.5;

interface EmscFeature {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: {
    unid: string;
    time: string;
    lastupdate: string;
    flynn_region: string;
    lat: number;
    lon: number;
    depth: number;
    mag: number;
    magtype: string;
    evtype?: string;
    auth?: string;
  };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s,.-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export function fromEmsc(f: EmscFeature): EarthquakeFeature {
  const p = f.properties;
  return {
    type: "Feature",
    id: `emsc-${p.unid}`,
    properties: {
      mag: p.mag,
      place: titleCase(p.flynn_region),
      time: Date.parse(p.time),
      updated: Date.parse(p.lastupdate),
      url: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(p.unid)}`,
      alert: null,
      status: "reviewed",
      tsunami: 0,
      sig: 0,
      magType: p.magtype,
      felt: null,
      source: "EMSC",
    },
    geometry: { type: "Point", coordinates: [p.lon, p.lat, p.depth] },
  };
}

function withUsgsSource(f: EarthquakeFeature): EarthquakeFeature {
  return { ...f, properties: { ...f.properties, source: "USGS" } };
}

/** Mismo sismo reportado por dos agencias: ≤90 s, ≤150 km y magnitud parecida. */
export function isSameEvent(a: EarthquakeFeature, b: EarthquakeFeature): boolean {
  if (Math.abs(a.properties.time - b.properties.time) > 90_000) return false;
  const [ax, ay] = a.geometry.coordinates;
  const [bx, by] = b.geometry.coordinates;
  if (haversineKm([ax, ay], [bx, by]) > 150) return false;
  const am = a.properties.mag ?? 0;
  const bm = b.properties.mag ?? 0;
  return Math.abs(am - bm) <= 1;
}

export function mergeQuakes(usgs: EarthquakeFeature[], emsc: EarthquakeFeature[]): EarthquakeFeature[] {
  const merged = usgs.map(withUsgsSource);
  // Índice por minuto para no comparar todo contra todo.
  const byMinute = new Map<number, EarthquakeFeature[]>();
  for (const f of merged) {
    const k = Math.floor(f.properties.time / 60_000);
    byMinute.set(k, [...(byMinute.get(k) ?? []), f]);
  }
  for (const e of emsc) {
    const k = Math.floor(e.properties.time / 60_000);
    const candidates = [k - 2, k - 1, k, k + 1, k + 2].flatMap((m) => byMinute.get(m) ?? []);
    if (!candidates.some((u) => isSameEvent(u, e))) merged.push(e);
  }
  return merged.sort((a, b) => b.properties.time - a.properties.time);
}

async function fetchUsgs(period: QuakePeriod, signal?: AbortSignal): Promise<EarthquakeGeoJSON> {
  const res = await fetch(USGS_FEEDS[period], { signal: withTimeout(8000, signal) });
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  return (await res.json()) as EarthquakeGeoJSON;
}

async function loadEmsc(params: Record<string, string | number>, signal?: AbortSignal): Promise<EarthquakeFeature[]> {
  const qs = new URLSearchParams({ format: "json", limit: "2000", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${EMSC_FDSN}?${qs}`, { signal });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`EMSC HTTP ${res.status}`);
  const data: { features: EmscFeature[] } = await res.json();
  return data.features.filter((f) => f.properties.evtype !== "qb").map(fromEmsc);
}

async function fetchEmsc(params: Record<string, string | number>, signal?: AbortSignal): Promise<EarthquakeFeature[]> {
  try {
    return await loadEmsc(params, signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.error("Error obteniendo sismos de EMSC:", err);
    return [];
  }
}

export async function loadMergedEarthquakes(period: QuakePeriod, signal?: AbortSignal): Promise<EarthquakeGeoJSON> {
  const since = new Date(Date.now() - (period === "week" ? 7 : 1) * 86_400_000).toISOString().slice(0, 19);
  const results = await Promise.allSettled([
    fetchUsgs(period, signal),
    loadEmsc({ start: since, minmag: EMSC_MIN_MAG }, withTimeout(8000, signal)),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") continue;
    const err: unknown = result.reason;
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.error(`Error obteniendo sismos de ${index === 0 ? "USGS" : "EMSC"}:`, err);
  }
  const [usgsResult, emscResult] = results;
  if (usgsResult.status === "rejected" && emscResult.status === "rejected") {
    throw new Error("USGS y EMSC no disponibles");
  }
  const usgs = usgsResult.status === "fulfilled" ? usgsResult.value : null;
  const emsc = emscResult.status === "fulfilled" ? emscResult.value : [];
  const features = mergeQuakes(usgs?.features ?? [], emsc);
  return {
    type: "FeatureCollection",
    metadata: {
      generated: usgs?.metadata.generated ?? Date.now(),
      url: "",
      title: "USGS + EMSC",
      status: 200,
      api: "merged",
      count: features.length,
    },
    features,
  };
}

export async function fetchMergedEarthquakes(period: QuakePeriod, signal?: AbortSignal): Promise<EarthquakeGeoJSON> {
  try {
    return await loadMergedEarthquakes(period, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return {
      type: "FeatureCollection",
      metadata: {
        generated: Date.now(),
        url: "",
        title: "USGS + EMSC",
        status: 200,
        api: "merged",
        count: 0,
      },
      features: [],
    };
  }
}

/**
 * Historial sísmico alrededor de un punto (30 días, M≥2.5) para el panel de
 * detalle: USGS FDSN + EMSC FDSN, deduplicados.
 */
export async function fetchQuakeHistory(lat: number, lon: number, radiusKm = 150, days = 30, signal?: AbortSignal): Promise<EarthquakeFeature[]> {
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19);
  const usgsUrl = `${USGS_FDSN}?${new URLSearchParams({
    format: "geojson",
    latitude: String(lat),
    longitude: String(lon),
    maxradiuskm: String(radiusKm),
    starttime: start,
    minmagnitude: "2.5",
    orderby: "time",
    limit: "500",
  })}`;
  const [usgs, emsc] = await Promise.all([
    fetch(usgsUrl, { signal })
      .then((r) => (r.ok ? (r.json() as Promise<EarthquakeGeoJSON>) : null))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      }),
    fetchEmsc({ lat, lon, maxradius: kmToDeg(radiusKm).toFixed(3), start, minmag: 2.5 }, signal),
  ]);
  return mergeQuakes(usgs?.features ?? [], emsc);
}
