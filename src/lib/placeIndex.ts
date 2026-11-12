// Sugerencias locales instantaneas a partir de CITY_ANCHORS.
import { CITY_ANCHORS, type CityAnchor } from "./cityAnchors";
import { haversineKm } from "./geo";
import type { GeocodeResult } from "./pointInfo";
import { DEPARTMENTS } from "./zones/nicaragua";

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

type Place = CityAnchor & { detail?: string };

const CITY_NAMES = new Set(CITY_ANCHORS.map((c) => normalizeText(c.name)));
const DEFAULT_PLACES: readonly Place[] = [
  ...CITY_ANCHORS,
  ...DEPARTMENTS.filter((d) => !CITY_NAMES.has(normalizeText(d.capital))).map((d) => ({
    name: d.capital,
    lon: d.capitalLon,
    lat: d.capitalLat,
    detail: `${d.name}, Nicaragua`,
  })),
];

export function nearestKnownPlace(
  lon: number,
  lat: number,
  maxKm = 25,
): { name: string; region: string | null; country: string | null; distanceKm: number } | null {
  let best: { name: string; region: string | null; country: string | null; distanceKm: number } | null = null;
  const consider = (name: string, region: string | null, country: string | null, pLon: number, pLat: number) => {
    const distanceKm = haversineKm([lon, lat], [pLon, pLat]);
    if (distanceKm <= maxKm && (!best || distanceKm < best.distanceKm)) best = { name, region, country, distanceKm };
  };
  for (const d of DEPARTMENTS) consider(d.capital, d.name, "Nicaragua", d.capitalLon, d.capitalLat);
  // Una ciudad ancla que ya es cabecera (Managua) no debe ganar con menos datos.
  const capitals = new Set(DEPARTMENTS.map((d) => normalizeText(d.capital)));
  for (const c of CITY_ANCHORS) if (!capitals.has(normalizeText(c.name))) consider(c.name, null, null, c.lon, c.lat);
  return best;
}

export function searchPlaces(text: string, limit = 5, places: readonly Place[] = DEFAULT_PLACES): GeocodeResult[] {
  const q = normalizeText(text);
  if (q.length < 2) return [];
  const prefix: Place[] = [];
  const inside: Place[] = [];
  for (const place of places) {
    const name = normalizeText(place.name);
    if (name.startsWith(q)) prefix.push(place);
    else if (name.includes(q)) inside.push(place);
  }
  return [...prefix, ...inside]
    .slice(0, limit)
    .map((p) => ({ name: p.name, detail: p.detail ?? "", lon: p.lon, lat: p.lat, kind: "city" }));
}
