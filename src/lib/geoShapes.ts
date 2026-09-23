import type { TrackPoint } from "./types";

// Geometrías calculadas en el cliente: trayectoria continua de la ISS,
// huella de visibilidad y la zona nocturna (línea día/noche).

const EARTH_RADIUS_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * "Desenrolla" las longitudes para que la línea sea continua al cruzar el
 * antimeridiano (179 → 181 en vez de 179 → -179). MapLibre dibuja
 * longitudes fuera de ±180 sin problema, así no aparecen trazos que cruzan
 * todo el mapa.
 */
export function unwrapLongitudes(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let offset = 0;
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    if (i > 0) {
      const prev = points[i - 1][0];
      if (lon - prev > 180) offset -= 360;
      else if (prev - lon > 180) offset += 360;
    }
    out.push([lon + offset, lat]);
  }
  return out;
}

export function trackLine(track: TrackPoint[], anchor?: [number, number]): [number, number][] {
  const pts = track.map(([lon, lat]) => [lon, lat] as [number, number]);
  const line = unwrapLongitudes(pts);
  // Alinea el tramo con la posición actual (mismo "mundo" que el marcador).
  if (anchor && line.length) {
    const ref = line[line.length - 1][0];
    const shift = Math.round((anchor[0] - ref) / 360) * 360;
    if (shift) return line.map(([lon, lat]) => [lon + shift, lat]);
  }
  return line;
}

/** Punto destino desde (lon, lat) con rumbo y ángulo central (radianes). */
function destination(lon: number, lat: number, bearing: number, angular: number): [number, number] {
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(angular) + Math.cos(φ1) * Math.sin(angular) * Math.cos(bearing));
  const λ2 = λ1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(φ1), Math.cos(angular) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(λ2), toDeg(φ2)];
}

/**
 * Huella de visibilidad de un satélite: zona de la Tierra desde la que se
 * ve sobre el horizonte con al menos `minElevationDeg` de elevación.
 * Para la ISS (~420 km, 10°) el radio es de ~1.400 km.
 */
export function footprintRing(lon: number, lat: number, altitudeKm: number, minElevationDeg = 10, steps = 72): [number, number][] {
  const ε = toRad(minElevationDeg);
  const central = Math.acos((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) * Math.cos(ε)) - ε;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    ring.push(destination(lon, lat, (2 * Math.PI * i) / steps, central));
  }
  return unwrapLongitudes(ring);
}

/** Radio (km) de la huella de visibilidad. */
export function footprintRadiusKm(altitudeKm: number, minElevationDeg = 10): number {
  const ε = toRad(minElevationDeg);
  return (Math.acos((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) * Math.cos(ε)) - ε) * EARTH_RADIUS_KM;
}

/** Punto subsolar aproximado (precisión ~0.5°, suficiente para el mapa). */
export function subsolarPoint(date: Date): { lon: number; lat: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - start) / 86_400_000;
  const g = (2 * Math.PI * (dayOfYear - 1)) / 365;
  const declination =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqTimeMin =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const lon = -((utcMinutes + eqTimeMin - 720) / 4);
  return { lon: ((lon + 540) % 360) - 180, lat: toDeg(declination) };
}

/**
 * Polígono del hemisferio nocturno: la línea del terminador se cierra por
 * el polo que queda de noche.
 */
export function nightPolygon(date: Date): [number, number][] {
  const sun = subsolarPoint(date);
  // Evita la división por cero en los equinoccios.
  const decl = Math.abs(sun.lat) < 0.1 ? (sun.lat >= 0 ? 0.1 : -0.1) : sun.lat;
  const tanDecl = Math.tan(toRad(decl));
  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = toDeg(Math.atan(-Math.cos(toRad(lon - sun.lon)) / tanDecl));
    ring.push([lon, lat]);
  }
  const pole = decl > 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole], ring[0]);
  return ring;
}
