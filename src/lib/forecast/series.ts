import type { ForecastHorizon, ForecastSample, GridForecast, HourlyAirQuality, HourlyWeather, WeatherFrame } from "./types";

const HOUR_MS = 3_600_000;

export function sliceHours<T extends { time: number[] }>(series: T, hours: ForecastHorizon, fromMs: number = series.time[0]): T {
  const end = fromMs + hours * HOUR_MS;
  const keep: number[] = [];
  series.time.forEach((t, i) => {
    if (t >= fromMs && t < end) keep.push(i);
  });
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(series)) {
    out[key] = Array.isArray(value) ? keep.map((i) => value[i]) : value;
  }
  return out as T;
}

export function hourIndexAt(time: number[], atMs: number): number | null {
  if (!time.length || atMs < time[0] || atMs > time[time.length - 1] + HOUR_MS) return null;
  let lo = 0;
  let hi = time.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (time[mid] <= atMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function windUV(speed: number, directionDeg: number): { u: number; v: number } {
  const rad = (directionDeg * Math.PI) / 180;
  return { u: -speed * Math.sin(rad) + 0, v: -speed * Math.cos(rad) + 0 };
}

export function accumulate(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

export function sampleAt(weather: HourlyWeather, air: HourlyAirQuality | null, atMs: number): ForecastSample | null {
  const i = hourIndexAt(weather.time, atMs);
  if (i === null) return null;
  const j = air ? hourIndexAt(air.time, atMs) : null;
  const speed = weather.windSpeed[i];
  const dir = weather.windDirection[i];
  let accum = 0;
  for (let k = 0; k <= i; k++) accum += weather.precipitation[k];
  return {
    time: weather.time[i],
    hourIndex: i,
    temperature: weather.temperature[i],
    apparentTemperature: weather.apparentTemperature[i],
    humidity: weather.humidity[i],
    surfacePressure: weather.surfacePressure[i],
    cloudCover: weather.cloudCover[i],
    precipitation: weather.precipitation[i],
    precipitationAccum: accum,
    precipitationProbability: weather.precipitationProbability[i],
    wind: { ...windUV(speed, dir), speed, gust: weather.windGusts[i] },
    windDirection: dir,
    uvIndex: weather.uvIndex[i],
    weatherCode: weather.weatherCode[i],
    isDay: weather.isDay[i],
    pm25: air && j !== null ? air.pm25[j] : null,
    pm10: air && j !== null ? air.pm10[j] : null,
    usAqi: air && j !== null ? air.usAqi[j] : null,
  };
}

export function frameAt(grid: GridForecast, atMs: number): WeatherFrame | null {
  const i = hourIndexAt(grid.time, atMs);
  if (i === null) return null;
  return {
    time: grid.time[i],
    features: grid.points.map((p, n) => {
      const w = grid.weather[n];
      return {
        lon: p.lon,
        lat: p.lat,
        windSpeed: w.windSpeed[i],
        windDirection: w.windDirection[i],
        windGusts: w.windGusts[i],
        ...windUV(w.windSpeed[i], w.windDirection[i]),
        cloudCover: w.cloudCover[i],
        precipitation: w.precipitation[i],
        precipitationProbability: w.precipitationProbability[i],
        temperature: w.temperature[i],
      };
    }),
  };
}

export function usAqiCategory(aqi: number | null): "good" | "moderate" | "sensitive" | "unhealthy" | "veryUnhealthy" | "hazardous" | null {
  if (aqi === null || Number.isNaN(aqi)) return null;
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "veryUnhealthy";
  return "hazardous";
}
