import { AQICategory, AirQualityGeoJSON, AirQualityFeature } from "./types";
import { CityAnchor, CITY_ANCHORS } from "./cityAnchors";

const OPENAQ_BASE = "https://api.openaq.org/v3";
const PM25_PARAMETER_ID = 2;
const SEARCH_RADIUS_METERS = 25000;

interface OpenAQLocationsResponse {
  results: {
    id: number;
    name: string;
    coordinates: { latitude: number; longitude: number };
    sensors: { id: number; parameter: { name: string } }[];
  }[];
}

interface OpenAQSensorResponse {
  results: {
    latest: { value: number; datetime: { utc: string } } | null;
  }[];
}

interface NearestStation {
  locationName: string;
  sensorId: number;
  latitude: number;
  longitude: number;
}

export function getAQICategory(pm25: number): AQICategory {
  if (pm25 <= 12.0) return "good";
  if (pm25 <= 35.4) return "moderate";
  if (pm25 <= 55.4) return "unhealthy";
  return "hazardous";
}

async function fetchNearestPm25Station(
  anchor: CityAnchor,
  apiKey: string,
  signal?: AbortSignal
): Promise<NearestStation | null> {
  const url = `${OPENAQ_BASE}/locations?coordinates=${anchor.lat},${anchor.lon}&radius=${SEARCH_RADIUS_METERS}&parameters_id=${PM25_PARAMETER_ID}&limit=1`;
  const res = await fetch(url, { headers: { "X-API-Key": apiKey }, signal });
  if (!res.ok) return null;

  const data: OpenAQLocationsResponse = await res.json();
  const location = data.results[0];
  if (!location) return null;

  const sensor = location.sensors.find((s) => s.parameter.name === "pm25");
  if (!sensor) return null;

  return {
    locationName: location.name,
    sensorId: sensor.id,
    latitude: location.coordinates.latitude,
    longitude: location.coordinates.longitude,
  };
}

async function fetchSensorLatestValue(
  sensorId: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<number | null> {
  const res = await fetch(`${OPENAQ_BASE}/sensors/${sensorId}`, {
    headers: { "X-API-Key": apiKey },
    signal,
  });
  if (!res.ok) return null;

  const data: OpenAQSensorResponse = await res.json();
  const value = data.results[0]?.latest?.value;
  return value === undefined ? null : value;
}

export async function fetchLiveAirQuality(signal?: AbortSignal): Promise<AirQualityGeoJSON> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    // Sin clave no hay datos: nunca se inventan lecturas (antes se devolvía un
    // mock con valores fijos que la web y la ingesta trataban como reales).
    console.error("OPENAQ_API_KEY no configurada: sin datos de calidad del aire");
    return { type: "FeatureCollection", features: [] };
  }

  const features: AirQualityFeature[] = [];

  for (const anchor of CITY_ANCHORS) {
    try {
      const station = await fetchNearestPm25Station(anchor, apiKey, signal);
      if (!station) continue;

      const pm25 = await fetchSensorLatestValue(station.sensorId, apiKey, signal);
      // OpenAQ reporta lecturas negativas cuando el sensor esta descalibrado o sin datos validos.
      if (pm25 === null || pm25 < 0) continue;

      features.push({
        type: "Feature",
        id: station.sensorId,
        properties: {
          station: station.locationName,
          pm25,
          category: getAQICategory(pm25),
          updated: new Date().toISOString(),
        },
        geometry: {
          type: "Point",
          coordinates: [station.longitude, station.latitude],
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      console.error(`Error obteniendo calidad de aire para ${anchor.name}:`, error);
    }
  }

  return { type: "FeatureCollection", features };
}

// ---------- Cobertura global para la web ----------
// /v3/parameters/2/latest devuelve la última lectura de PM2.5 de todos los
// sensores; con datetime_min solo los que reportaron en las últimas horas
// (~10.000 en todo el mundo). Mucho mejor que 10 ciudades fijas.

const FRESH_HOURS = 3;
const MAX_PAGES = 12;
const PAGE_SIZE = 1000;

interface OpenAQLatestResponse {
  meta: { found: number | string };
  results: {
    datetime: { utc: string };
    value: number;
    coordinates: { latitude: number; longitude: number };
    sensorsId: number;
    locationsId: number;
  }[];
}

export async function fetchGlobalAirQuality(signal?: AbortSignal): Promise<AirQualityGeoJSON> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    console.error("OPENAQ_API_KEY no configurada: sin datos de calidad del aire");
    return { type: "FeatureCollection", features: [] };
  }
  const since = new Date(Date.now() - FRESH_HOURS * 3_600_000).toISOString();
  const page = (n: number) =>
    fetch(`${OPENAQ_BASE}/parameters/${PM25_PARAMETER_ID}/latest?limit=${PAGE_SIZE}&page=${n}&datetime_min=${encodeURIComponent(since)}`, {
      headers: { "X-API-Key": apiKey },
      signal,
    }).then((r) => (r.ok ? (r.json() as Promise<OpenAQLatestResponse>) : null));

  try {
    const first = await page(1);
    if (!first) return { type: "FeatureCollection", features: [] };
    const found = Number(first.meta.found) || first.results.length;
    const pages = Math.min(MAX_PAGES, Math.ceil(found / PAGE_SIZE));
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2).catch(() => null)));
    const rows = [first, ...rest].flatMap((r) => r?.results ?? []);

    // Una lectura por estación (la más reciente); se descartan valores
    // imposibles (sensores descalibrados reportan negativos o miles).
    const byLocation = new Map<number, OpenAQLatestResponse["results"][number]>();
    for (const r of rows) {
      if (!(r.value >= 0 && r.value < 1000)) continue;
      const prev = byLocation.get(r.locationsId);
      if (!prev || Date.parse(r.datetime.utc) > Date.parse(prev.datetime.utc)) byLocation.set(r.locationsId, r);
    }

    const features: AirQualityFeature[] = [...byLocation.values()].map((r) => ({
      type: "Feature",
      id: r.locationsId,
      properties: {
        station: `OpenAQ ${r.locationsId}`,
        pm25: Math.round(r.value * 10) / 10,
        category: getAQICategory(r.value),
        updated: r.datetime.utc,
        locationId: r.locationsId,
        sensorId: r.sensorsId,
      },
      geometry: { type: "Point", coordinates: [r.coordinates.longitude, r.coordinates.latitude] },
    }));
    return { type: "FeatureCollection", features };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo calidad del aire global de OpenAQ:", error);
    return { type: "FeatureCollection", features: [] };
  }
}

/** Nombre de la estación e historial horario de PM2.5 (48 h) para el panel de detalle. */
export async function fetchStationHistory(
  locationId: number,
  sensorId: number,
  signal?: AbortSignal
): Promise<{ name: string | null; locality: string | null; country: string | null; history: { t: string; v: number }[] }> {
  const apiKey = process.env.OPENAQ_API_KEY;
  const empty = { name: null, locality: null, country: null, history: [] };
  if (!apiKey) return empty;
  const headers = { "X-API-Key": apiKey };
  const from = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const [loc, hours] = await Promise.all([
    fetch(`${OPENAQ_BASE}/locations/${locationId}`, { headers, signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${OPENAQ_BASE}/sensors/${sensorId}/hours?datetime_from=${encodeURIComponent(from)}&limit=100`, { headers, signal })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  const l = loc?.results?.[0];
  const history = ((hours?.results ?? []) as { value: number; period: { datetimeTo: { utc: string } } }[])
    .filter((h) => h.value >= 0 && h.value < 1000)
    .map((h) => ({ t: h.period.datetimeTo.utc, v: Math.round(h.value * 10) / 10 }));
  return { name: l?.name ?? null, locality: l?.locality ?? null, country: l?.country?.name ?? null, history };
}
