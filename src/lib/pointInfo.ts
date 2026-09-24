// Información de un punto cualquiera del mapa para el panel de detalle:
// tiempo actual + pronóstico 24 h (Open-Meteo), PM2.5 modelado (Open-Meteo
// Air Quality) y nombre del lugar (Photon / OpenStreetMap). Sustituye a las
// capas de "clima" y "aire modelado" de 10 ciudades fijas: ahora sirve
// para cualquier lugar del planeta. La búsqueda de lugares usa el geocoder
// de Open-Meteo (GeoNames), que sí devuelve nombres en español.

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const PHOTON = "https://photon.komoot.io";
const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
const USER_AGENT = { "User-Agent": "EcoPulse (https://github.com/NormanSMA/EcoPulse)" };

export interface PointInfo {
  place: { name: string | null; region: string | null; country: string | null };
  current: {
    temperature: number;
    apparent: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    precipitation: number;
    weatherCode: number;
    isDay: boolean;
  } | null;
  hourly: { t: string; temp: number; precipProb: number; pm25: number | null }[];
  pm25: number | null;
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

export async function fetchPointInfo(lat: number, lon: number, lang: string, signal?: AbortSignal): Promise<PointInfo> {
  const forecastUrl = `${FORECAST}?${new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,is_day",
    hourly: "temperature_2m,precipitation_probability",
    forecast_hours: "24",
    timezone: "UTC",
  })}`;
  const airUrl = `${AIR}?${new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "pm2_5",
    hourly: "pm2_5",
    forecast_hours: "24",
    timezone: "UTC",
  })}`;
  // Photon no tiene español: "default" da el nombre local (bien en
  // Latinoamérica y España). Si ese nombre no está en alfabeto latino
  // (東京都, Москва…) se repite la consulta en inglés.
  const reverseUrl = (l: string) => `${PHOTON}/reverse?lat=${lat}&lon=${lon}&lang=${l}`;

  const json = (url: string) =>
    fetch(url, { signal, headers: USER_AGENT })
      .then((r) => (r.ok ? r.json() : null))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        return null;
      });

  const [forecast, air, reverseLocal] = await Promise.all([json(forecastUrl), json(airUrl), json(reverseUrl(lang === "es" ? "default" : "en"))]);
  const localProps: PhotonFeature["properties"] | undefined = reverseLocal?.features?.[0]?.properties;
  const reverse =
    localProps && !isLatin([localProps.name, localProps.city, localProps.country].filter(Boolean).join(" ")) ? (await json(reverseUrl("en"))) ?? reverseLocal : reverseLocal;

  const c = forecast?.current;
  const times: string[] = forecast?.hourly?.time ?? [];
  const airTimes: string[] = air?.hourly?.time ?? [];
  const pmByTime = new Map<string, number>(airTimes.map((t: string, i: number) => [t, air.hourly.pm2_5[i]]));
  const feature: PhotonFeature | undefined = reverse?.features?.[0];

  return {
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
    current: c
      ? {
          temperature: c.temperature_2m,
          apparent: c.apparent_temperature,
          humidity: c.relative_humidity_2m,
          windSpeed: c.wind_speed_10m,
          windDirection: c.wind_direction_10m,
          precipitation: c.precipitation,
          weatherCode: c.weather_code,
          isDay: c.is_day === 1,
        }
      : null,
    hourly: times.map((t, i) => ({
      t: `${t}Z`,
      temp: forecast.hourly.temperature_2m[i],
      precipProb: forecast.hourly.precipitation_probability?.[i] ?? 0,
      pm25: pmByTime.get(t) ?? null,
    })),
    pm25: air?.current?.pm2_5 ?? null,
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
