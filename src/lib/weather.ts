import { WeatherFeature, WeatherGeoJSON } from "./types";
import { CITY_ANCHORS } from "./cityAnchors";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna densa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia fuerte",
  71: "Nieve ligera",
  73: "Nieve moderada",
  75: "Nieve fuerte",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos fuertes",
  95: "Tormenta eléctrica",
  96: "Tormenta con granizo ligero",
  99: "Tormenta con granizo fuerte",
};

export function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "Condición desconocida";
}

interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
  };
}

export async function fetchLiveWeather(signal?: AbortSignal): Promise<WeatherGeoJSON> {
  const lats = CITY_ANCHORS.map((c) => c.lat).join(",");
  const lons = CITY_ANCHORS.map((c) => c.lon).join(",");
  const url = `${OPEN_METEO_BASE}?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=UTC`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data: OpenMeteoCurrentResponse[] = await res.json();
    const features: WeatherFeature[] = data.map((entry, idx) => {
      const anchor = CITY_ANCHORS[idx];
      const weatherCode = entry.current.weather_code;
      return {
        type: "Feature",
        id: anchor.name,
        properties: {
          city: anchor.name,
          temperature: entry.current.temperature_2m,
          humidity: entry.current.relative_humidity_2m,
          windSpeed: entry.current.wind_speed_10m,
          windDirection: entry.current.wind_direction_10m,
          weatherCode,
          weatherDescription: describeWeatherCode(weatherCode),
          updated: new Date(entry.current.time + "Z").toISOString(),
        },
        geometry: {
          type: "Point",
          coordinates: [anchor.lon, anchor.lat],
        },
      };
    });

    return { type: "FeatureCollection", features };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo clima de Open-Meteo:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
