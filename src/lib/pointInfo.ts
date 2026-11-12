// Información de un punto cualquiera del mapa para el panel de detalle:
// tiempo actual + pronóstico horario de 72 h y calidad del aire modelada
// (lib/forecast, Open-Meteo) y nombre del lugar (Photon / OpenStreetMap). Sustituye a las
// capas de "clima" y "aire modelado" de 10 ciudades fijas: ahora sirve
// para cualquier lugar del planeta. La búsqueda de lugares usa el geocoder
// de Open-Meteo (GeoNames), que sí devuelve nombres en español.

import { withTimeout } from "./http";
import { fetchPointForecast } from "./forecast/openMeteo";
import { hourIndexAt } from "./forecast/series";
import type { PointForecast } from "./forecast/types";

const PHOTON = "https://photon.komoot.io";
const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
// El nombre del lugar es accesorio: no debe retrasar el pronóstico si Photon va lento.
const REVERSE_TIMEOUT_MS = 4000;
const USER_AGENT = { "User-Agent": "EcoPulse (https://github.com/NormanSMA/EcoPulse)" };

/** PM2.5 modelado para la hora indicada (por defecto, ahora). */
export function modeledPm25(forecast: Pick<PointForecast, "air"> | null | undefined, atMs = Date.now()): number | null {
  const air = forecast?.air;
  if (!air) return null;
  const index = hourIndexAt(air.time, atMs);
  return index === null ? null : air.pm25[index];
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; city?: string; district?: string; locality?: string; county?: string; state?: string; country?: string; osm_value?: string; type?: string };
}

export interface GeocodeResult {
  name: string;
  detail: string;
  lon: number;
  lat: number;
  kind: string;
}

/** ¿El texto está escrito (sobre todo) en alfabeto latino? */
export function isLatin(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return true;
  const latin = letters.filter((c) => /\p{Script=Latin}/u.test(c)).length;
  return latin / letters.length >= 0.5;
}

function placeFrom(p: PhotonFeature["properties"]) {
  return {
    name: p.name ?? p.city ?? p.county ?? null,
    region: p.state ?? p.county ?? null,
    country: p.country ?? null,
  };
}

export async function fetchPointInfo(lat: number, lon: number, lang: string, signal?: AbortSignal): Promise<PointForecast> {
  // Photon no tiene español: "default" da el nombre local (bien en
  // Latinoamérica y España). Si ese nombre no está en alfabeto latino
  // (東京都, Москва…) se repite la consulta en inglés.
  const reverseUrl = (l: string) => `${PHOTON}/reverse?lat=${lat}&lon=${lon}&lang=${l}`;

  const json = (url: string) =>
    fetch(url, { signal: withTimeout(REVERSE_TIMEOUT_MS, signal), headers: USER_AGENT })
      .then((r) => (r.ok ? r.json() : null))
      .catch((err) => {
        if (signal?.aborted) throw err;
        return null;
      });

  // El pronóstico tolera sus propios fallos: sin aire entrega `air: null`.
  const [core, reverseLocal] = await Promise.all([fetchPointForecast(lat, lon, signal), json(reverseUrl(lang === "es" ? "default" : "en"))]);
  const localProps: PhotonFeature["properties"] | undefined = reverseLocal?.features?.[0]?.properties;
  const reverse =
    localProps && !isLatin([localProps.name, localProps.city, localProps.country].filter(Boolean).join(" ")) ? (await json(reverseUrl("en"))) ?? reverseLocal : reverseLocal;
  const feature: PhotonFeature | undefined = reverse?.features?.[0];

  return {
    lat,
    lon,
    // Reverse: se prefiere la localidad a la calle o el edificio más cercano.
    place: feature
      ? {
          ...placeFrom(feature.properties),
          name:
            feature.properties.type === "city" || feature.properties.type === "state" || feature.properties.type === "country"
              ? feature.properties.name ?? null
              : feature.properties.city ?? feature.properties.locality ?? feature.properties.district ?? feature.properties.county ?? feature.properties.name ?? null,
        }
      : { name: null, region: null, country: null },
    ...core,
  };
}

interface GeocoderResult {
  name: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  country?: string;
  admin1?: string;
}

export async function geocode(q: string, lang: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = `${GEOCODER}?${new URLSearchParams({ name: q, count: "8", language: lang === "es" ? "es" : "en", format: "json" })}`;
  const res = await fetch(url, { signal, headers: USER_AGENT });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data: { results?: GeocoderResult[] } = await res.json();
  const seen = new Set<string>();
  return (data.results ?? [])
    .map((r) => ({
      name: r.name,
      detail: [r.admin1, r.country].filter((x) => x && x !== r.name).join(", "),
      lon: r.longitude,
      lat: r.latitude,
      kind: r.feature_code ?? "",
    }))
    .filter((r) => {
      const key = `${r.name}|${r.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}
