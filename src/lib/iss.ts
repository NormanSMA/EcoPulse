import { IssFeature, IssGeoJSON, TrackPoint } from "./types";

const ISS_OEM_URL = "https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.txt";
const EARTH_RADIUS_KM = 6378.137;

export interface StateVector {
  timestamp: Date;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

const STATE_VECTOR_LINE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/;

export function parseOemFile(text: string): StateVector[] {
  const vectors: StateVector[] = [];
  for (const line of text.split("\n")) {
    const match = STATE_VECTOR_LINE.exec(line);
    if (!match) continue;
    vectors.push({
      timestamp: new Date(match[1] + "Z"),
      x: Number(match[2]),
      y: Number(match[3]),
      z: Number(match[4]),
      vx: Number(match[5]),
      vy: Number(match[6]),
      vz: Number(match[7]),
    });
  }
  return vectors;
}

export function interpolateStateVector(vectors: StateVector[], at: Date): StateVector | null {
  if (vectors.length === 0) return null;

  let before: StateVector | null = null;
  let after: StateVector | null = null;
  for (const v of vectors) {
    if (v.timestamp.getTime() <= at.getTime()) {
      if (!before || v.timestamp.getTime() > before.timestamp.getTime()) before = v;
    }
    if (v.timestamp.getTime() >= at.getTime()) {
      if (!after || v.timestamp.getTime() < after.timestamp.getTime()) after = v;
    }
  }

  if (!before && !after) return null;
  if (!before) return after;
  if (!after) return before;
  if (before === after) return before;

  // Hermite cúbico con las velocidades del propio archivo OEM: los vectores
  // vienen cada ~4 min (~1800 km de arco) y una interpolación lineal cortaría
  // la curva de la órbita (error de decenas de km en posición y altitud).
  const dtSec = (after.timestamp.getTime() - before.timestamp.getTime()) / 1000;
  const u = dtSec > 0 ? (at.getTime() - before.timestamp.getTime()) / 1000 / dtSec : 0;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  const pos = (p0: number, v0: number, p1: number, v1: number) => h00 * p0 + h10 * dtSec * v0 + h01 * p1 + h11 * dtSec * v1;
  const lerp = (a: number, b: number) => a + (b - a) * u;

  return {
    timestamp: at,
    x: pos(before.x, before.vx, after.x, after.vx),
    y: pos(before.y, before.vy, after.y, after.vy),
    z: pos(before.z, before.vz, after.z, after.vz),
    vx: lerp(before.vx, after.vx),
    vy: lerp(before.vy, after.vy),
    vz: lerp(before.vz, after.vz),
  };
}

// GMST (Greenwich Mean Sidereal Time), formula IAU 1982 - necesario para
// convertir el vector de posicion del marco inercial EME2000 (fijo respecto
// a las estrellas) al marco fijo a la Tierra (ECEF), del cual sale lat/lon.
export function gmstRadians(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const gmstSeconds =
    67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
  const gmstDegrees = ((gmstSeconds % 86400) / 240 + 360) % 360;
  return (gmstDegrees * Math.PI) / 180;
}

export interface GeodeticPosition {
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

// Convierte ECI (x,y,z en km, marco EME2000) a lat/lon/altitud usando una
// Tierra esferica (aproximacion suficiente para ubicar un marcador en el
// mapa; no es para navegacion de precision).
export function eciToGeodetic(x: number, y: number, z: number, at: Date): GeodeticPosition {
  const gmst = gmstRadians(at);
  const xEcef = x * Math.cos(gmst) + y * Math.sin(gmst);
  const yEcef = -x * Math.sin(gmst) + y * Math.cos(gmst);
  const zEcef = z;

  const longitude = (Math.atan2(yEcef, xEcef) * 180) / Math.PI;
  const latitude = (Math.atan2(zEcef, Math.sqrt(xEcef * xEcef + yEcef * yEcef)) * 180) / Math.PI;
  const radius = Math.sqrt(xEcef * xEcef + yEcef * yEcef + zEcef * zEcef);

  return { latitude, longitude, altitudeKm: radius - EARTH_RADIUS_KM };
}

const TRACK_PAST_MIN = 45;
const TRACK_FUTURE_MIN = 90;

/** Trayectoria real [lon, lat, altKm] muestreada cada minuto entre from y to. */
export function computeTrack(vectors: StateVector[], from: Date, to: Date, stepMs = 60_000): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
    const at = new Date(t);
    const sv = interpolateStateVector(vectors, at);
    if (!sv) continue;
    const g = eciToGeodetic(sv.x, sv.y, sv.z, at);
    points.push([g.longitude, g.latitude, g.altitudeKm]);
  }
  return points;
}

/** Rumbo inicial (grados desde el norte) entre dos puntos lon/lat. */
export function bearingDeg(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lon1, lat1] = from.map(toRad);
  const [lon2, lat2] = to.map(toRad);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export async function fetchLiveIssPosition(signal?: AbortSignal): Promise<IssGeoJSON> {
  try {
    const res = await fetch(ISS_OEM_URL, { signal });
    if (!res.ok) {
      throw new Error(`ISS OEM HTTP ${res.status}`);
    }
    const text = await res.text();
    const vectors = parseOemFile(text);
    const now = new Date();
    const state = interpolateStateVector(vectors, now);
    if (!state) {
      return { type: "FeatureCollection", features: [] };
    }

    const { latitude, longitude, altitudeKm } = eciToGeodetic(state.x, state.y, state.z, state.timestamp);
    const velocityKmS = Math.sqrt(state.vx ** 2 + state.vy ** 2 + state.vz ** 2);
    const past = computeTrack(vectors, new Date(now.getTime() - TRACK_PAST_MIN * 60_000), now);
    const future = computeTrack(vectors, now, new Date(now.getTime() + TRACK_FUTURE_MIN * 60_000));
    const headingDeg = future.length > 1 ? bearingDeg([longitude, latitude], [future[1][0], future[1][1]]) : undefined;

    const feature: IssFeature = {
      type: "Feature",
      id: "iss",
      properties: {
        altitudeKm,
        velocityKmS,
        timestamp: state.timestamp.toISOString(),
        headingDeg,
        track: { past, future },
      },
      geometry: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    };

    return { type: "FeatureCollection", features: [feature] };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo posicion de la ISS:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
