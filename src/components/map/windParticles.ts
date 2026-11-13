import { kmToDeg, type BBox } from "@/lib/geo";
import { sampleWind, type WindField } from "@/lib/forecast/field";

export type Particle = { lon: number; lat: number; age: number; maxAge: number };

const MAX_AGE = 100;

function randomIn(bbox: BBox, rng: () => number): [number, number] {
  return [bbox[0] + rng() * (bbox[2] - bbox[0]), bbox[1] + rng() * (bbox[3] - bbox[1])];
}

export function createParticles(
  count: number,
  bbox: BBox,
  rng: () => number = Math.random,
): Particle[] {
  return Array.from({ length: count }, () => {
    const [lon, lat] = randomIn(bbox, rng);
    return { lon, lat, age: rng() * MAX_AGE, maxAge: MAX_AGE };
  });
}

/**
 * Avanza las particulas. u y v vienen de WeatherFrame en km/h (unidad por defecto
 * de Open-Meteo). speedScale amplifica el movimiento solo para la animacion.
 */
export function stepParticles(
  particles: Particle[],
  field: WindField,
  dtSeconds: number,
  bbox: BBox,
  rng: () => number = Math.random,
  speedScale = 1,
): void {
  const reset = (p: Particle) => {
    [p.lon, p.lat] = randomIn(bbox, rng);
    p.age = 0;
  };
  for (const p of particles) {
    const [u, v] = sampleWind(field, p.lon, p.lat);
    if (u === 0 && v === 0) {
      reset(p);
      continue;
    }
    const kmPerSec = (dtSeconds * speedScale) / 3600;
    const cosLat = Math.max(Math.cos((p.lat * Math.PI) / 180), 0.01);
    p.lon += kmToDeg(u * kmPerSec) / cosLat;
    p.lat += kmToDeg(v * kmPerSec);
    p.age += dtSeconds;
    const outside = p.lon < bbox[0] || p.lon > bbox[2] || p.lat < bbox[1] || p.lat > bbox[3];
    if (p.age > p.maxAge || outside) reset(p);
  }
}

export function particleCountFor(areaPx: number, isMobile: boolean): number {
  const max = isMobile ? 1200 : 3000;
  const proportional = Math.round(areaPx / 700);
  return Math.max(300, Math.min(max, proportional));
}

export function windSpeedScale(zoom: number, targetPxPerSec = 40, refKmh = 30): number {
  const pixelsPerDegree = (512 * 2 ** zoom) / 360;
  const degreesPerSecond = (refKmh / 3600) * (1 / 111.2);
  return targetPxPerSec / (degreesPerSecond * pixelsPerDegree);
}
