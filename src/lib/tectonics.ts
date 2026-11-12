import { pointToSegmentKm as geoPointToSegmentKm } from "./geo";
import type { TectonicBoundaryGeoJSON, TectonicBoundaryType, TectonicPlateGeoJSON, TectonicStepClass } from "./types";

/** Distancia (km) de un punto a un segmento (esférica, ver geo.ts). */
export function pointToSegmentKm(lon: number, lat: number, a: [number, number], b: [number, number]): number {
  return geoPointToSegmentKm([lon, lat], a, b);
}

export interface NearestBoundary {
  plates: string;
  type: TectonicBoundaryType;
  stepClass: TectonicStepClass;
  distanceKm: number;
  velocityMmYr: number;
}

/** Límite de placa más cercano al punto, o null si no hay datos. */
export function nearestBoundary(lon: number, lat: number, boundaries: TectonicBoundaryGeoJSON | null | undefined): NearestBoundary | null {
  let best: NearestBoundary | null = null;
  for (const f of boundaries?.features ?? []) {
    const c = f.geometry.coordinates;
    for (let i = 0; i < c.length - 1; i++) {
      const d = pointToSegmentKm(lon, lat, c[i], c[i + 1]);
      if (!best || d < best.distanceKm) {
        const p = f.properties;
        best = { plates: p.plates, type: p.type, stepClass: p.stepClass, distanceKm: d, velocityMmYr: p.velocityMmYr };
      }
    }
  }
  return best;
}

/** "NZ\SA", "NZ/SA" o "NZ-SA" -> ["NZ", "SA"] (PB2002 usa \ y / para indicar qué placa subduce). */
export function splitPlates(pair: string): string[] {
  return pair.split(/[-/\\]/).filter(Boolean);
}

/** Nombre original de la placa según su código (o el propio código). */

export function plateName(code: string, plates: TectonicPlateGeoJSON | null | undefined): string {
  return plates?.features.find((f) => f.properties.code === code)?.properties.name ?? code;
}
