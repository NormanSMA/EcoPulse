import boundaryCatalog from "../../public/data/tectonics/boundaries.json";
import type { EarthquakeFeature, EarthquakeGeoJSON } from "./types";

const USGS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const EARTH_RADIUS_KM = 6371;
const CATALOG_LIMIT = 20_000;
export const BOUNDARY_HISTORY = {
  starttime: "1900-01-01",
  minMagnitude: 7,
  radiusKm: 100,
  // En subducción los grandes sismos ocurren tierra adentro de la fosa
  // (Valdivia 1960 a ~140 km, Maule 2010 a ~107 km): radio mayor.
  convergentRadiusKm: 250,
} as const;

type Coordinate = readonly number[];
export interface PlateBoundary {
  plates: string;
  lines: number[][][];
  convergent: boolean;
}

function normalizePlates(plates: string): string {
  return plates.trim().toUpperCase().replace(/[/\\]/g, "-");
}

export function findPlateBoundary(plates: string | null): PlateBoundary | null {
  if (!plates) return null;
  const normalized = normalizePlates(plates);
  if (!/^[A-Z]{2}-[A-Z]{2}$/.test(normalized)) return null;
  const [first, second] = normalized.split("-");
  const reversed = `${second}-${first}`;
  const matches = boundaryCatalog.features.filter((feature) => {
    const pair = normalizePlates(feature.properties.plates);
    return pair === normalized || pair === reversed;
  });
  if (!matches.length) return null;
  return {
    plates: normalizePlates(matches[0].properties.plates),
    lines: matches.map((feature) => feature.geometry.coordinates),
    convergent: matches.some((feature) => feature.properties.type === "convergent"),
  };
}

const radians = (degrees: number) => degrees * Math.PI / 180;

function angularDistance(first: Coordinate, second: Coordinate): number {
  const latitudeDelta = radians(second[1] - first[1]);
  const longitudeDelta = radians(second[0] - first[0]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first[1])) * Math.cos(radians(second[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

function bearing(first: Coordinate, second: Coordinate): number {
  const longitudeDelta = radians(second[0] - first[0]);
  const firstLatitude = radians(first[1]);
  const secondLatitude = radians(second[1]);
  return Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(secondLatitude),
    Math.cos(firstLatitude) * Math.sin(secondLatitude)
      - Math.sin(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta),
  );
}

function segmentDistanceKm(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const fromStart = angularDistance(start, point);
  const segmentLength = angularDistance(start, end);
  if (segmentLength < 1e-12) return fromStart * EARTH_RADIUS_KM;
  const angle = bearing(start, point) - bearing(start, end);
  const alongTrack = Math.atan2(Math.sin(fromStart) * Math.cos(angle), Math.cos(fromStart));
  if (alongTrack < 0 || alongTrack > segmentLength) {
    return Math.min(fromStart, angularDistance(end, point)) * EARTH_RADIUS_KM;
  }
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(fromStart) * Math.sin(angle))))) * EARTH_RADIUS_KM;
}

export function distanceToBoundaryKm(point: Coordinate, lines: PlateBoundary["lines"]): number {
  let nearest = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index++) {
      nearest = Math.min(nearest, segmentDistanceKm(point, line[index - 1], line[index]));
    }
  }
  return nearest;
}

export interface BoundaryHistoryFeature extends EarthquakeFeature {
  properties: EarthquakeFeature["properties"] & { distanceKm: number };
}

export function selectBoundaryEarthquakes(
  features: EarthquakeFeature[], boundary: PlateBoundary,
): BoundaryHistoryFeature[] {
  const selected = new Map<EarthquakeFeature["id"], BoundaryHistoryFeature>();
  for (const feature of features) {
    if (feature.properties.mag === null || feature.properties.mag < BOUNDARY_HISTORY.minMagnitude) continue;
    const distanceKm = distanceToBoundaryKm(feature.geometry.coordinates, boundary.lines);
    if (distanceKm > (boundary.convergent ? BOUNDARY_HISTORY.convergentRadiusKm : BOUNDARY_HISTORY.radiusKm)) continue;
    selected.set(feature.id, {
      ...feature,
      properties: { ...feature.properties, source: "USGS", distanceKm: Math.round(distanceKm) },
    });
  }
  return [...selected.values()]
    .sort((first, second) => (second.properties.mag! - first.properties.mag!)
      || second.properties.time - first.properties.time);
}

export function summarizeBoundaryHistory(features: BoundaryHistoryFeature[]) {
  const decades = new Map<number, number>();
  for (const feature of features) {
    const decade = Math.floor(new Date(feature.properties.time).getUTCFullYear() / 10) * 10;
    decades.set(decade, (decades.get(decade) ?? 0) + 1);
  }
  return {
    features,
    total: features.length,
    strongest: features[0] ?? null,
    byDecade: [...decades.entries()]
      .sort(([first], [second]) => first - second)
      .map(([decade, count]) => ({ decade, count })),
  };
}

export async function fetchBoundaryHistory(
  boundary: PlateBoundary, signal?: AbortSignal,
): Promise<BoundaryHistoryFeature[]> {
  // El catálogo global evita excluir segmentos cercanos al antimeridiano o a los polos.
  const query = new URLSearchParams({
    format: "geojson",
    starttime: BOUNDARY_HISTORY.starttime,
    minmagnitude: String(BOUNDARY_HISTORY.minMagnitude),
    eventtype: "earthquake",
    orderby: "magnitude",
    limit: String(CATALOG_LIMIT),
  });
  const response = await fetch(`${USGS_QUERY}?${query}`, {
    next: { revalidate: 86_400 },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
  const catalog = await response.json() as EarthquakeGeoJSON;
  if (catalog.features.length >= CATALOG_LIMIT) throw new Error("USGS: catálogo histórico truncado");
  return selectBoundaryEarthquakes(catalog.features, boundary);
}
