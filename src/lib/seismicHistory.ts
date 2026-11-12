import { parseLatLon } from "./apiResponse";
import { BOUNDARY_HISTORY, fetchBoundaryHistory, findPlateBoundary, summarizeBoundaryHistory, type BoundaryHistoryFeature } from "./boundaryHistory";
import { fetchQuakeHistory } from "./earthquakes";
import { withTimeout } from "./http";
import type { EarthquakeFeature } from "./types";

export type SeismicHistoryQuery =
  | { mode: "point"; lat: number; lon: number; radiusKm: number; days: number }
  | { mode: "boundary"; plates: string };

export interface SeismicHistory {
  type: "FeatureCollection";
  metadata: {
    mode: "point" | "boundary";
    sources: string[];
    starttime: string;
    minMagnitude: number;
    radiusKm: number;
    count: number;
    plates?: string;
  };
  features: EarthquakeFeature[];
  summary?: { total: number; strongest: BoundaryHistoryFeature | null; byDecade: { decade: number; count: number }[] };
}

export const POINT_HISTORY = { radiusKm: 150, days: 30, minMagnitude: 2.5, maxRadiusKm: 500, maxDays: 30 } as const;

function optionalNumber(params: URLSearchParams, name: string, fallback: number, max: number): number | null {
  const values = params.getAll(name);
  if (values.length === 0) return fallback;
  const raw = values[0].trim();
  if (values.length > 1 || !raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 && value <= max ? value : null;
}

export function parseSeismicHistoryQuery(params: URLSearchParams): SeismicHistoryQuery | null {
  const mode = params.get("mode") ?? (params.has("plates") && !params.has("lat") && !params.has("lon") ? "boundary" : "point");
  if (mode === "boundary") {
    const plates = params.get("plates");
    if (params.getAll("plates").length !== 1 || !findPlateBoundary(plates)) return null;
    return { mode, plates: findPlateBoundary(plates)!.plates };
  }
  if (mode !== "point") return null;
  const point = parseLatLon(new URL(`http://localhost/?${new URLSearchParams({
    lat: params.get("lat") ?? "", lon: params.get("lon") ?? "",
  })}`));
  const radiusKm = optionalNumber(params, "radiusKm", POINT_HISTORY.radiusKm, POINT_HISTORY.maxRadiusKm);
  const days = optionalNumber(params, "days", POINT_HISTORY.days, POINT_HISTORY.maxDays);
  if (!point || radiusKm === null || days === null) return null;
  return { mode, ...point, radiusKm, days };
}

export async function loadSeismicHistory(query: SeismicHistoryQuery, signal?: AbortSignal): Promise<SeismicHistory> {
  if (query.mode === "point") {
    const features = await fetchQuakeHistory(query.lat, query.lon, query.radiusKm, query.days, withTimeout(8000, signal));
    return {
      type: "FeatureCollection",
      metadata: {
        mode: "point",
        sources: ["USGS", "EMSC"],
        starttime: new Date(Date.now() - query.days * 86_400_000).toISOString().slice(0, 19),
        minMagnitude: POINT_HISTORY.minMagnitude,
        radiusKm: query.radiusKm,
        count: features.length,
      },
      features,
    };
  }
  const boundary = findPlateBoundary(query.plates);
  if (!boundary) throw new Error(`Límite desconocido: ${query.plates}`);
  const { features, ...summary } = summarizeBoundaryHistory(await fetchBoundaryHistory(boundary, signal));
  return {
    type: "FeatureCollection",
    metadata: {
      mode: "boundary",
      sources: ["USGS"],
      starttime: BOUNDARY_HISTORY.starttime,
      minMagnitude: BOUNDARY_HISTORY.minMagnitude,
      radiusKm: boundary.convergent ? BOUNDARY_HISTORY.convergentRadiusKm : BOUNDARY_HISTORY.radiusKm,
      count: features.length,
      plates: boundary.plates,
    },
    features,
    summary,
  };
}
