import type { GridForecast, HourlyAirQuality, PointForecast } from "../forecast/types";
import { haversineKm } from "../geo";
import type { ZonePack, ZonePackMeta } from "../zones/types";
import { getDb } from "./db";

const AIR_NEIGHBOR_KM = 60;

export async function savePack(pack: ZonePack): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const tx = db.transaction(["packMeta", "packData"], "readwrite");
    await Promise.all([
      tx.objectStore("packMeta").put(pack.meta),
      tx.objectStore("packData").put({ forecast: pack.forecast, events: pack.events }, pack.meta.id),
      tx.done,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function listPacks(): Promise<ZonePackMeta[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    return (await db.getAll("packMeta")).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getPack(id: string): Promise<ZonePack | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [meta, data] = await Promise.all([db.get("packMeta", id), db.get("packData", id)]);
    return meta && data ? { meta, forecast: data.forecast, events: data.events } : null;
  } catch {
    return null;
  }
}

export async function deletePack(id: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const tx = db.transaction(["packMeta", "packData"], "readwrite");
    await Promise.all([tx.objectStore("packMeta").delete(id), tx.objectStore("packData").delete(id), tx.done]);
    return true;
  } catch {
    return false;
  }
}

export function isExpired(meta: ZonePackMeta, now: number): boolean {
  return meta.validUntil < now;
}

function nearestIndex(
  grid: GridForecast,
  lon: number,
  lat: number,
  accept?: (i: number) => boolean,
): { index: number; distanceKm: number } | null {
  let best: { index: number; distanceKm: number } | null = null;
  for (let index = 0; index < grid.points.length; index++) {
    if (accept && !accept(index)) continue;
    const p = grid.points[index];
    const distanceKm = haversineKm([lon, lat], [p.lon, p.lat]);
    if (!best || distanceKm < best.distanceKm) best = { index, distanceKm };
  }
  return best;
}

export function nearestPoint(pack: ZonePack, lon: number, lat: number): { index: number; distanceKm: number } | null {
  return nearestIndex(pack.forecast, lon, lat);
}

export async function forecastFromPacks(
  lon: number,
  lat: number,
  now: number,
  maxKm = 30,
): Promise<{ forecast: PointForecast; zone: string } | null> {
  const metas = (await listPacks()).filter((m) => !isExpired(m, now));
  let best: { pack: ZonePack; index: number; distanceKm: number } | null = null;
  // listPacks ordena del más reciente al más antiguo: el empate lo gana el primero.
  for (const meta of metas) {
    const pack = await getPack(meta.id);
    if (!pack) continue;
    const hit = nearestPoint(pack, lon, lat);
    if (hit && hit.distanceKm <= maxKm && (!best || hit.distanceKm < best.distanceKm)) best = { pack, ...hit };
  }
  if (!best) return null;

  const { pack, index } = best;
  const grid = pack.forecast;
  const point = grid.points[index];
  const toAir = (i: number): HourlyAirQuality | null => {
    const air = grid.air[i];
    return air ? { time: grid.time, ...air } : null;
  };
  let air = toAir(index);
  if (!air) {
    const near = nearestIndex(grid, point.lon, point.lat, (i) => i !== index && grid.air[i] !== null);
    if (near && near.distanceKm <= AIR_NEIGHBOR_KM) air = toAir(near.index);
  }
  return {
    zone: pack.meta.zone.name,
    forecast: {
      lat: point.lat,
      lon: point.lon,
      place: { name: point.label ?? null, region: null, country: null },
      current: null,
      weather: { time: grid.time, ...grid.weather[index] },
      air,
      meta: { ...grid.meta, source: "pack" },
    },
  };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usedBytes: number; quotaBytes: number } | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usedBytes: usage ?? 0, quotaBytes: quota ?? 0 };
  } catch {
    return null;
  }
}
