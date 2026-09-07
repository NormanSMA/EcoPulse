import { IssFeature, IssGeoJSON } from "./types";

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

  const total = after.timestamp.getTime() - before.timestamp.getTime();
  const frac = total > 0 ? (at.getTime() - before.timestamp.getTime()) / total : 0;

  const lerp = (a: number, b: number) => a + (b - a) * frac;

  return {
    timestamp: at,
    x: lerp(before.x, after.x),
    y: lerp(before.y, after.y),
    z: lerp(before.z, after.z),
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

    const feature: IssFeature = {
      type: "Feature",
      id: "iss",
      properties: {
        altitudeKm,
        velocityKmS,
        timestamp: state.timestamp.toISOString(),
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
