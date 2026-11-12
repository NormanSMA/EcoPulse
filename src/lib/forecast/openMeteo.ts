import { withTimeout } from "../http";
import type { CurrentWeather, ForecastCore, ForecastMeta, GridForecast, GridPoint, HourlyAirQuality, HourlyWeather } from "./types";

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
export const FORECAST_HOURS = 72;

const USER_AGENT = { "User-Agent": "EcoPulse (https://github.com/NormanSMA/EcoPulse)" };
const POINT_TIMEOUT_MS = 8000;
const GRID_TIMEOUT_MS = 12000;

const WEATHER_HOURLY =
  "temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,cloud_cover,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,weather_code,is_day";
const WEATHER_CURRENT =
  "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,uv_index,weather_code,is_day";
const AIR_HOURLY = "pm2_5,pm10,us_aqi";

type RawColumns = Record<string, (number | null)[] | undefined>;
type RawCurrent = Record<string, number | null | undefined>;
interface RawResponse {
  hourly?: RawColumns;
  current?: RawCurrent;
  utc_offset_seconds?: number;
}

const times = (raw: RawColumns): number[] => (raw.time ?? []).map((t) => (t ?? 0) * 1000);
const req = (raw: RawColumns, key: string): number[] => (raw[key] ?? []).map((v) => v ?? 0);
const opt = (raw: RawColumns, key: string): (number | null)[] => (raw[key] ?? []).map((v) => v ?? null);

export function toHourlyWeather(raw: RawColumns): HourlyWeather {
  return {
    time: times(raw),
    temperature: req(raw, "temperature_2m"),
    apparentTemperature: req(raw, "apparent_temperature"),
    humidity: req(raw, "relative_humidity_2m"),
    surfacePressure: req(raw, "surface_pressure"),
    cloudCover: req(raw, "cloud_cover"),
    precipitationProbability: opt(raw, "precipitation_probability"),
    precipitation: req(raw, "precipitation"),
    windSpeed: req(raw, "wind_speed_10m"),
    windDirection: req(raw, "wind_direction_10m"),
    windGusts: req(raw, "wind_gusts_10m"),
    uvIndex: opt(raw, "uv_index"),
    weatherCode: req(raw, "weather_code"),
    isDay: req(raw, "is_day").map((v) => v === 1),
  };
}

export function toHourlyAirQuality(raw: RawColumns): HourlyAirQuality {
  return { time: times(raw), pm25: opt(raw, "pm2_5"), pm10: opt(raw, "pm10"), usAqi: opt(raw, "us_aqi") };
}

export function toCurrentWeather(raw: RawCurrent): CurrentWeather {
  const n = (key: string) => raw[key] ?? 0;
  return {
    temperature: n("temperature_2m"),
    apparent: n("apparent_temperature"),
    humidity: n("relative_humidity_2m"),
    windSpeed: n("wind_speed_10m"),
    windDirection: n("wind_direction_10m"),
    windGusts: n("wind_gusts_10m"),
    precipitation: n("precipitation"),
    cloudCover: n("cloud_cover"),
    surfacePressure: n("surface_pressure"),
    uvIndex: raw.uv_index ?? null,
    weatherCode: n("weather_code"),
    isDay: raw.is_day === 1,
  };
}

const baseParams = { forecast_hours: String(FORECAST_HOURS), timeformat: "unixtime", timezone: "UTC" };

function weatherUrl(lat: string, lon: string, withCurrent: boolean): string {
  const params: Record<string, string> = { latitude: lat, longitude: lon, hourly: WEATHER_HOURLY, ...baseParams };
  if (withCurrent) params.current = WEATHER_CURRENT;
  return `${FORECAST_URL}?${new URLSearchParams(params)}`;
}

function airUrl(lat: string, lon: string): string {
  return `${AIR_URL}?${new URLSearchParams({ latitude: lat, longitude: lon, hourly: AIR_HOURLY, ...baseParams })}`;
}

async function getJson(url: string, ms: number, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal: withTimeout(ms, signal), headers: USER_AGENT });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return res.json();
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

const makeMeta = (utcOffsetSeconds: number): ForecastMeta => ({
  generatedAt: Date.now(),
  horizonHours: 72,
  utcOffsetSeconds,
  models: { weather: "open-meteo", air: "open-meteo-cams" },
  source: "network",
});

export async function fetchPointForecast(lat: number, lon: number, signal?: AbortSignal): Promise<ForecastCore> {
  const la = lat.toFixed(3);
  const lo = lon.toFixed(3);
  const [w, a] = await Promise.allSettled([
    getJson(weatherUrl(la, lo, true), POINT_TIMEOUT_MS, signal),
    getJson(airUrl(la, lo), POINT_TIMEOUT_MS, signal),
  ]);
  throwIfAborted(signal);
  const weatherRaw = w.status === "fulfilled" ? (w.value as RawResponse | null) : null;
  const airRaw = a.status === "fulfilled" ? (a.value as RawResponse | null) : null;
  return {
    current: weatherRaw?.current ? toCurrentWeather(weatherRaw.current) : null,
    weather: weatherRaw?.hourly ? toHourlyWeather(weatherRaw.hourly) : null,
    air: airRaw?.hourly ? toHourlyAirQuality(airRaw.hourly) : null,
    meta: makeMeta(weatherRaw?.utc_offset_seconds ?? 0),
  };
}

const asArray = (data: unknown): RawResponse[] => (Array.isArray(data) ? data : [data]) as RawResponse[];
function stripTime<T extends { time: number[] }>(series: T): Omit<T, "time"> {
  const rest: Partial<T> = { ...series };
  delete rest.time;
  return rest as Omit<T, "time">;
}

export async function fetchGridForecast(points: GridPoint[], signal?: AbortSignal, airEvery = 1): Promise<GridForecast> {
  if (!points.length) throw new Error("fetchGridForecast: sin puntos");
  const join = (list: GridPoint[], key: "lat" | "lon") => list.map((p) => p[key].toFixed(3)).join(",");
  const step = Math.max(1, airEvery);
  const airIdx = points.map((_, i) => i).filter((i) => i % step === 0 || points[i].anchor);
  const airPoints = airIdx.map((i) => points[i]);

  const [w, a] = await Promise.allSettled([
    getJson(weatherUrl(join(points, "lat"), join(points, "lon"), false), GRID_TIMEOUT_MS, signal),
    getJson(airUrl(join(airPoints, "lat"), join(airPoints, "lon")), GRID_TIMEOUT_MS, signal),
  ]);
  throwIfAborted(signal);
  if (w.status === "rejected") throw w.reason;
  const weatherList = asArray(w.value);
  if (weatherList.length !== points.length) {
    throw new Error(`Open-Meteo devolvio ${weatherList.length} respuestas para ${points.length} puntos`);
  }
  const weather = weatherList.map((r) => toHourlyWeather(r.hourly ?? {}));

  const air: (Omit<HourlyAirQuality, "time"> | null)[] = points.map(() => null);
  if (a.status === "fulfilled") {
    const airList = asArray(a.value);
    if (airList.length === airPoints.length) {
      airIdx.forEach((pointIndex, n) => {
        const hourly = airList[n].hourly;
        if (hourly) air[pointIndex] = stripTime(toHourlyAirQuality(hourly));
      });
    }
  }

  return {
    points,
    time: weather[0].time,
    weather: weather.map(stripTime),
    air,
    meta: makeMeta(weatherList[0].utc_offset_seconds ?? 0),
  };
}
