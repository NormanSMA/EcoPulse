// Sugerencias locales instantaneas a partir de CITY_ANCHORS.
import { CITY_ANCHORS, type CityAnchor } from "./cityAnchors";
import type { GeocodeResult } from "./pointInfo";

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchPlaces(text: string, limit = 5, places: readonly CityAnchor[] = CITY_ANCHORS): GeocodeResult[] {
  const q = normalizeText(text);
  if (q.length < 2) return [];
  const prefix: CityAnchor[] = [];
  const inside: CityAnchor[] = [];
  for (const place of places) {
    const name = normalizeText(place.name);
    if (name.startsWith(q)) prefix.push(place);
    else if (name.includes(q)) inside.push(place);
  }
  return [...prefix, ...inside]
    .slice(0, limit)
    .map((p) => ({ name: p.name, detail: "", lon: p.lon, lat: p.lat, kind: "city" }));
}
