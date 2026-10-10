import type { TectonicBoundaryGeoJSON, TectonicBoundaryType, TectonicPlateGeoJSON, TectonicStepClass } from "./types";

const R_KM = 6371;
const RAD = Math.PI / 180;

/**
 * Distancia (km) de un punto a un segmento, en plano local equirectangular
 * centrado en el punto. Suficiente para segmentos cortos de PB2002.
 */
export function pointToSegmentKm(lon: number, lat: number, a: [number, number], b: [number, number]): number {
  const k = Math.cos(lat * RAD);
  const dx = (lng: number) => {
    let d = lng - lon;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d * RAD * k * R_KM;
  };
  const dy = (la: number) => (la - lat) * RAD * R_KM;
  const ax = dx(a[0]);
  const ay = dy(a[1]);
  const bx = dx(b[0]);
  const by = dy(b[1]);
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len2));
  return Math.hypot(ax + t * vx, ay + t * vy);
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
