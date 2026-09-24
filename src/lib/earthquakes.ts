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

function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Mismo sismo reportado por dos agencias: ≤90 s, ≤150 km y magnitud parecida. */
export function isSameEvent(a: EarthquakeFeature, b: EarthquakeFeature): boolean {
  if (Math.abs(a.properties.time - b.properties.time) > 90_000) return false;
  const [ax, ay] = a.geometry.coordinates;
  const [bx, by] = b.geometry.coordinates;
  if (distanceKm([ax, ay], [bx, by]) > 150) return false;
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

async function fetchUsgs(period: QuakePeriod, signal?: AbortSignal): Promise<EarthquakeGeoJSON | null> {
  try {
    const res = await fetch(USGS_FEEDS[period], { signal });
    if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
    return (await res.json()) as EarthquakeGeoJSON;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.error("Error obteniendo sismos de USGS:", err);
    return null;
  }
}

async function fetchEmsc(params: Record<string, string | number>, signal?: AbortSignal): Promise<EarthquakeFeature[]> {
  try {
    const qs = new URLSearchParams({ format: "json", limit: "2000", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res = await fetch(`${EMSC_FDSN}?${qs}`, { signal });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`EMSC HTTP ${res.status}`);
    const data: { features: EmscFeature[] } = await res.json();
    return data.features.filter((f) => f.properties.evtype !== "qb").map(fromEmsc);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    console.error("Error obteniendo sismos de EMSC:", err);
    return [];
  }
}

export async function fetchMergedEarthquakes(period: QuakePeriod, signal?: AbortSignal): Promise<EarthquakeGeoJSON> {
  const since = new Date(Date.now() - (period === "week" ? 7 : 1) * 86_400_000).toISOString().slice(0, 19);
  const [usgs, emsc] = await Promise.all([
    fetchUsgs(period, signal),
    fetchEmsc({ start: since, minmag: EMSC_MIN_MAG }, signal),
  ]);
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
    fetchEmsc({ lat, lon, maxradius: (radiusKm / 111.2).toFixed(3), start, minmag: 2.5 }, signal),
  ]);
  return mergeQuakes(usgs?.features ?? [], emsc);
}
