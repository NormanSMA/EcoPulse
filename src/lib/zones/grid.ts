import type { GridPoint } from "../forecast/types";
import { bboxAround, bboxContains, haversineKm } from "../geo";
import { CAPITALS, DEPARTMENTS, departmentAt, inNicaragua, NICARAGUA_BBOX } from "./nicaragua";
import type { ZoneSpec } from "./types";

export const TIERS = {
  tactical: { stepDeg: 0.05, maxPoints: 36, halfSizeKm: 12.5 },
  metro: { stepDeg: 0.1, maxPoints: 64, halfSizeKm: 50 },
  country: { stepDeg: 0.5, maxPoints: 80 },
} as const;

const ANCHOR_DEDUP_KM = 15;
const EPS = 1e-9;
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function snap(value: number, stepDeg: number): number {
  return round4(Math.round(value / stepDeg) * stepDeg);
}

const pointId = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function tacticalZone(lon: number, lat: number, name?: string): ZoneSpec {
  const cLon = snap(lon, TIERS.tactical.stepDeg);
  const cLat = snap(lat, TIERS.tactical.stepDeg);
  return {
    id: `tactical:${pointId(cLat, cLon)}`,
    tier: "tactical",
    name: name ?? `Zona ${pointId(cLat, cLon)}`,
    bbox: bboxAround(cLon, cLat, TIERS.tactical.halfSizeKm),
    center: [cLon, cLat],
    stepDeg: TIERS.tactical.stepDeg,
    maxPoints: TIERS.tactical.maxPoints,
  };
}

function metroBox(lon: number, lat: number, name?: string): ZoneSpec {
  const cLon = snap(lon, TIERS.metro.stepDeg);
  const cLat = snap(lat, TIERS.metro.stepDeg);
  const id = `${cLat.toFixed(1)},${cLon.toFixed(1)}`;
  return {
    id: `metro:${id}`,
    tier: "metro",
    name: name ?? `Zona ${id}`,
    bbox: bboxAround(cLon, cLat, TIERS.metro.halfSizeKm),
    center: [cLon, cLat],
    stepDeg: TIERS.metro.stepDeg,
    maxPoints: TIERS.metro.maxPoints,
  };
}

function departmentZone(d: (typeof DEPARTMENTS)[number]): ZoneSpec {
  return {
    id: `metro:${d.id}`,
    tier: "metro",
    name: d.name,
    bbox: d.bbox,
    center: [d.capitalLon, d.capitalLat],
    stepDeg: TIERS.metro.stepDeg,
    maxPoints: TIERS.metro.maxPoints,
  };
}

export function metroZone(lon: number, lat: number, name?: string): ZoneSpec {
  const dept = departmentAt(lon, lat);
  return dept ? departmentZone(dept) : metroBox(lon, lat, name);
}

export function countryZone(): ZoneSpec {
  const [w, s, e, n] = NICARAGUA_BBOX;
  return {
    id: "country:ni",
    tier: "country",
    name: "Nicaragua",
    bbox: NICARAGUA_BBOX,
    center: [round4((w + e) / 2), round4((s + n) / 2)],
    stepDeg: TIERS.country.stepDeg,
    maxPoints: TIERS.country.maxPoints,
  };
}

const NUM = "(-?\\d+(?:\\.\\d+)?)";
const COORD_ID = new RegExp(`^(tactical|metro):${NUM},${NUM}$`);

export function zoneFromId(id: string): ZoneSpec | null {
  if (id === "country:ni") return countryZone();
  if (id.startsWith("metro:ni-")) {
    const dept = DEPARTMENTS.find((d) => `metro:${d.id}` === id);
    return dept ? departmentZone(dept) : null;
  }
  const m = COORD_ID.exec(id);
  if (!m) return null;
  const lat = Number(m[2]);
  const lon = Number(m[3]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return m[1] === "tactical" ? tacticalZone(lon, lat) : metroBox(lon, lat);
}

function byPosition(a: GridPoint, b: GridPoint): number {
  return a.lat - b.lat || a.lon - b.lon;
}

function latticePoints(bbox: ZoneSpec["bbox"], step: number): GridPoint[] {
  const [w, s, e, n] = bbox;
  const out: GridPoint[] = [];
  for (let j = Math.ceil(s / step - EPS); j * step <= n + EPS; j++) {
    for (let i = Math.ceil(w / step - EPS); i * step <= e + EPS; i++) {
      const lat = round4(j * step);
      const lon = round4(i * step);
      out.push({ id: pointId(lat, lon), lon, lat });
    }
  }
  return out;
}

/** Submuestreo uniforme y determinista de una lista ordenada. */
function sample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max <= 0) return [];
  return Array.from({ length: max }, (_, k) => items[Math.floor((k * items.length) / max)]);
}

const anchorPoint = (name: string, lon: number, lat: number): GridPoint => ({
  id: pointId(lat, lon),
  lon,
  lat,
  label: name,
  anchor: true,
});

export function gridPoints(zone: ZoneSpec): GridPoint[] {
  let lattice = latticePoints(zone.bbox, zone.stepDeg);
  const anchors: GridPoint[] = [];
  if (zone.tier === "country") {
    lattice = lattice.filter(
      (p) => inNicaragua(p.lon, p.lat) && !CAPITALS.some((c) => haversineKm([p.lon, p.lat], [c.lon, c.lat]) < ANCHOR_DEDUP_KM),
    );
    for (const c of CAPITALS) anchors.push(anchorPoint(c.name, c.lon, c.lat));
  } else if (zone.tier === "metro") {
    const dept = DEPARTMENTS.find((d) => `metro:${d.id}` === zone.id);
    if (dept && bboxContains(zone.bbox, dept.capitalLon, dept.capitalLat)) {
      anchors.push(anchorPoint(dept.capital, dept.capitalLon, dept.capitalLat));
    }
  }
  return [...sample(lattice, zone.maxPoints - anchors.length), ...anchors].sort(byPosition);
}

export function airEveryFor(zone: ZoneSpec): number {
  return zone.tier === "tactical" ? 4 : zone.tier === "metro" ? 2 : 1;
}
