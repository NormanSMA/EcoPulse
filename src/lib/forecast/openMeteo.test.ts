import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGridForecast, fetchPointForecast, toCurrentWeather, toHourlyAirQuality, toHourlyWeather } from "./openMeteo";

const T0 = 1_700_000_000;
const WEATHER_VARS = [
  "temperature_2m", "apparent_temperature", "relative_humidity_2m", "surface_pressure", "cloud_cover", "precipitation_probability",
  "precipitation", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "uv_index", "weather_code", "is_day",
];

function rawWeather(n = 3) {
  const hourly: Record<string, number[]> = { time: Array.from({ length: n }, (_, i) => T0 + i * 3600) };
  for (const v of WEATHER_VARS) hourly[v] = Array.from({ length: n }, (_, i) => i + 1);
  hourly.is_day = Array.from({ length: n }, (_, i) => i % 2);
  return {
    utc_offset_seconds: 0,
    hourly,
    current: { temperature_2m: 20, apparent_temperature: 21, relative_humidity_2m: 50, wind_speed_10m: 5, wind_direction_10m: 90, wind_gusts_10m: 9, precipitation: 0, cloud_cover: 10, surface_pressure: 1010, uv_index: 3, weather_code: 1, is_day: 1 },
  };
}
const rawAir = (n = 3) => ({
  hourly: { time: Array.from({ length: n }, (_, i) => T0 + i * 3600), pm2_5: Array(n).fill(12), pm10: Array(n).fill(20), us_aqi: Array(n).fill(40) },
});
const ok = (body: unknown) => new Response(JSON.stringify(body));
const isAir = (url: string) => url.includes("air-quality-api");

afterEach(() => vi.unstubAllGlobals());

describe("mapeo puro", () => {
  it("convierte segundos a ms, nulos a 0 u null e is_day a boolean", () => {
    const w = toHourlyWeather({ time: [T0], temperature_2m: [null], precipitation_probability: [null], uv_index: [null], is_day: [1] });
    expect(w.time).toEqual([T0 * 1000]);
    expect(w.temperature).toEqual([0]);
    expect(w.precipitationProbability).toEqual([null]);
    expect(w.uvIndex).toEqual([null]);
    expect(w.isDay).toEqual([true]);
    expect(toHourlyAirQuality({ time: [T0], pm2_5: [null], pm10: [3], us_aqi: [null] })).toEqual({ time: [T0 * 1000], pm25: [null], pm10: [3], usAqi: [null] });
    const c = toCurrentWeather({ temperature_2m: null, uv_index: null, is_day: 0 });
    expect(c.temperature).toBe(0);
    expect(c.uvIndex).toBeNull();
    expect(c.isDay).toBe(false);
  });
});

describe("fetchPointForecast", () => {
  it("pide la URL con las 13 variables y forecast_hours=72", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(isAir(String(url)) ? rawAir() : rawWeather())));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchPointForecast(12.13456, -86.25, undefined);
    const urls = fetchMock.mock.calls.map((c) => new URL(String(c[0])));
    const w = urls.find((u) => u.host === "api.open-meteo.com")!;
    expect(w.pathname).toBe("/v1/forecast");
    expect(w.searchParams.get("hourly")).toBe(WEATHER_VARS.join(","));
    expect(w.searchParams.get("current")).toBe(
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,cloud_cover,surface_pressure,uv_index,weather_code,is_day",
    );
    expect(w.searchParams.get("forecast_hours")).toBe("72");
    expect(w.searchParams.get("timeformat")).toBe("unixtime");
    expect(w.searchParams.get("timezone")).toBe("UTC");
    expect(w.searchParams.get("latitude")).toBe("12.135");
    expect(w.searchParams.get("longitude")).toBe("-86.250");
    const a = urls.find((u) => u.host === "air-quality-api.open-meteo.com")!;
    expect(a.searchParams.get("hourly")).toBe("pm2_5,pm10,us_aqi");
    expect(a.searchParams.get("forecast_hours")).toBe("72");
    expect(r.weather?.time[0]).toBe(T0 * 1000);
    expect(r.air?.usAqi).toEqual([40, 40, 40]);
    expect(r.current?.isDay).toBe(true);
  });

  it("aire con HTTP 500: clima completo y air null", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(isAir(String(url)) ? new Response("x", { status: 500 }) : ok(rawWeather()))));
    const r = await fetchPointForecast(1, 2);
    expect(r.weather?.time).toHaveLength(3);
    expect(r.current).not.toBeNull();
    expect(r.air).toBeNull();
  });

  it("aire con fetch rechazado: clima completo y air null", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (isAir(String(url)) ? Promise.reject(new TypeError("red")) : Promise.resolve(ok(rawWeather())))));
    const r = await fetchPointForecast(1, 2);
    expect(r.weather).not.toBeNull();
    expect(r.air).toBeNull();
  });

  it("clima caido: weather y current null, aire presente", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(isAir(String(url)) ? ok(rawAir()) : new Response("x", { status: 503 }))));
    const r = await fetchPointForecast(1, 2);
    expect(r.weather).toBeNull();
    expect(r.current).toBeNull();
    expect(r.air).not.toBeNull();
  });

  it("relanza AbortError de la senal externa", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new DOMException("Aborted", "AbortError"))));
    const ctl = new AbortController();
    ctl.abort();
    await expect(fetchPointForecast(1, 2, ctl.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

const pts = [
  { id: "a", lat: 10, lon: -80 },
  { id: "b", lat: 11.5, lon: -81 },
  { id: "c", lat: 12, lon: -82 },
];

describe("fetchGridForecast", () => {
  it("1 punto: respuesta objeto, un fetch por API", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(isAir(String(url)) ? rawAir() : rawWeather())));
    vi.stubGlobal("fetch", fetchMock);
    const g = await fetchGridForecast([pts[0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(g.weather).toHaveLength(1);
    expect(g.air[0]?.pm25).toEqual([12, 12, 12]);
    expect(g.time[0]).toBe(T0 * 1000);
  });

  it("3 puntos: una llamada por API con coordenadas unidas por comas", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(ok(isAir(String(url)) ? [rawAir(), rawAir(), rawAir()] : [rawWeather(), rawWeather(), rawWeather()])));
    vi.stubGlobal("fetch", fetchMock);
    const g = await fetchGridForecast(pts);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const c of fetchMock.mock.calls) {
      const u = new URL(String(c[0]));
      expect(u.searchParams.get("latitude")).toBe("10.000,11.500,12.000");
      expect(u.searchParams.get("longitude")).toBe("-80.000,-81.000,-82.000");
    }
    expect(g.weather).toHaveLength(3);
    expect(g.air.every((a) => a !== null)).toBe(true);
  });

  it("airEvery=2: aire solo en indices pares y anclas", async () => {
    const four = [...pts, { id: "d", lat: 13, lon: -83, anchor: true }];
    const fetchMock = vi.fn((url: string) => {
      const u = new URL(String(url));
      const n = u.searchParams.get("latitude")!.split(",").length;
      return Promise.resolve(ok(isAir(String(url)) ? Array(n).fill(rawAir()) : Array(n).fill(rawWeather())));
    });
    vi.stubGlobal("fetch", fetchMock);
    const g = await fetchGridForecast(four, undefined, 2);
    const airUrl = fetchMock.mock.calls.map((c) => new URL(String(c[0]))).find((u) => u.host.startsWith("air"))!;
    expect(airUrl.searchParams.get("latitude")).toBe("10.000,12.000,13.000");
    expect(g.air.map((a) => a !== null)).toEqual([true, false, true, true]);
  });

  it("aire caido: todo null sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (isAir(String(url)) ? Promise.reject(new TypeError("red")) : Promise.resolve(ok([rawWeather(), rawWeather(), rawWeather()])))));
    const g = await fetchGridForecast(pts);
    expect(g.air).toEqual([null, null, null]);
  });

  it("lanza si el clima falla, el conteo no coincide o no hay puntos", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("x", { status: 500 }))));
    await expect(fetchGridForecast(pts)).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(ok(isAir(String(url)) ? [] : [rawWeather(), rawWeather()]))));
    await expect(fetchGridForecast(pts)).rejects.toThrow(/2 respuestas para 3/);
    await expect(fetchGridForecast([])).rejects.toThrow();
  });
});
