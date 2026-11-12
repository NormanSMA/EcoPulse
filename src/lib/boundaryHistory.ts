import boundaryCatalog from "../../public/data/tectonics/boundaries.json";
import { pointToSegmentKm } from "./geo";
import { withTimeout } from "./http";
import type { EarthquakeFeature, EarthquakeGeoJSON } from "./types";

const USGS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query";
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

export function distanceToBoundaryKm(point: Coordinate, lines: PlateBoundary["lines"]): number {
  let nearest = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index++) {
      nearest = Math.min(nearest, pointToSegmentKm(point, line[index - 1], line[index]));
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
    signal: withTimeout(20_000, signal),
  });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
  const catalog = await response.json() as EarthquakeGeoJSON;
  if (catalog.features.length >= CATALOG_LIMIT) throw new Error("USGS: catálogo histórico truncado");
  return selectBoundaryEarthquakes(catalog.features, boundary);
}
