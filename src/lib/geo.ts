// Geometría esférica compartida. Coordenadas siempre [lon, lat] en grados.

export const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG = 111.2;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

type Coordinate = readonly number[];
export type BBox = [west: number, south: number, east: number, north: number];

function angularDistance(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

function bearing(a: Coordinate, b: Coordinate): number {
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  return Math.atan2(
    Math.sin(dLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon),
  );
}

/** Distancia en km entre dos puntos (haversine). */
export function haversineKm(a: Coordinate, b: Coordinate): number {
  return angularDistance(a, b) * EARTH_RADIUS_KM;
}

/** Distancia esférica en km de un punto a un segmento. */
export function pointToSegmentKm(point: Coordinate, start: Coordinate, end: Coordinate): number {
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

/** Punto destino desde (lon, lat) con rumbo y ángulo central (radianes). */
export function destination(lon: number, lat: number, bearingRad: number, angularRad: number): [number, number] {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(angularRad) + Math.cos(φ1) * Math.sin(angularRad) * Math.cos(bearingRad));
  const λ2 = λ1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularRad) * Math.cos(φ1), Math.cos(angularRad) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(λ2), toDeg(φ2)];
}

/** Anillo geodésico cerrado (primer punto repetido al final). */
export function circleRing(lon: number, lat: number, radiusKm: number, steps = 72): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    ring.push(destination(lon, lat, (2 * Math.PI * i) / steps, radiusKm / EARTH_RADIUS_KM));
  }
  return ring;
}

export function kmToDeg(km: number): number {
  return km / KM_PER_DEG;
}

function lonSpanDeg(km: number, lat: number): number {
  return kmToDeg(km) / Math.max(Math.cos(toRad(Math.min(Math.abs(lat), 89))), 0.01);
}

export function bboxAround(lon: number, lat: number, halfSizeKm: number): BBox {
  const dLat = kmToDeg(halfSizeKm);
  const dLon = lonSpanDeg(halfSizeKm, lat);
  return [lon - dLon, Math.max(-90, lat - dLat), lon + dLon, Math.min(90, lat + dLat)];
}

export function bboxContains(bbox: BBox, lon: number, lat: number): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

export function expandBbox(bbox: BBox, marginKm: number): BBox {
  const [west, south, east, north] = bbox;
  const dLat = kmToDeg(marginKm);
  const dLon = lonSpanDeg(marginKm, Math.max(Math.abs(south), Math.abs(north)));
  return [west - dLon, Math.max(-90, south - dLat), east + dLon, Math.min(90, north + dLat)];
}

/** Ray casting sobre un anillo [lon, lat]. */
export function pointInPolygon(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
