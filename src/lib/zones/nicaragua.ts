import { bboxContains, haversineKm, pointInPolygon, pointToSegmentKm, type BBox } from "../geo";
import data from "./nicaragua.data.json";

export interface Department {
  id: string;
  name: string;
  capital: string;
  capitalLon: number;
  capitalLat: number;
  bbox: BBox;
}

export const NICARAGUA_OUTLINE = data.outline as [number, number][];
export const NICARAGUA_BBOX = data.bbox as BBox;
export const DEPARTMENTS = data.departments as Department[];

export const CAPITALS: { name: string; department: string; lon: number; lat: number }[] = DEPARTMENTS.map((d) => ({
  name: d.capital,
  department: d.name,
  lon: d.capitalLon,
  lat: d.capitalLat,
}));

/** Tolerancia al borde: el contorno simplificado puede dejar una cabecera costera fuera por pocos km. */
const BORDER_TOLERANCE_KM = 2.5;

export function inNicaragua(lon: number, lat: number): boolean {
  if (pointInPolygon(lon, lat, NICARAGUA_OUTLINE)) return true;
  for (let i = 1; i < NICARAGUA_OUTLINE.length; i++) {
    if (pointToSegmentKm([lon, lat], NICARAGUA_OUTLINE[i - 1], NICARAGUA_OUTLINE[i]) <= BORDER_TOLERANCE_KM) return true;
  }
  return false;
}

export function departmentAt(lon: number, lat: number): Department | null {
  let best: Department | null = null;
  let bestKm = Infinity;
  for (const d of DEPARTMENTS) {
    if (!bboxContains(d.bbox, lon, lat)) continue;
    const km = haversineKm([lon, lat], [d.capitalLon, d.capitalLat]);
    if (km < bestKm) {
      best = d;
      bestKm = km;
    }
  }
  return best;
}
