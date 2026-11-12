import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HOURS = 72;
const START = 1_794_500_000;
const column = (value: number) => Array.from({ length: HOURS }, () => value);

const weatherBody = {
  utc_offset_seconds: 0,
  current: {
    temperature_2m: 27, apparent_temperature: 30, relative_humidity_2m: 70, wind_speed_10m: 12, wind_direction_10m: 90,
    wind_gusts_10m: 25, precipitation: 0, cloud_cover: 40, surface_pressure: 1010, uv_index: 5, weather_code: 2, is_day: 1,
  },
  hourly: {
    time: Array.from({ length: HOURS }, (_, i) => START + i * 3600),
    temperature_2m: column(27), apparent_temperature: column(30), relative_humidity_2m: column(70), surface_pressure: column(1010),
    cloud_cover: column(40), precipitation_probability: column(20), precipitation: column(0.5), wind_speed_10m: column(12),
    wind_direction_10m: column(90), wind_gusts_10m: column(25), uv_index: column(5), weather_code: column(2), is_day: column(1),
  },
};
const airBody = {
  hourly: { time: weatherBody.hourly.time, pm2_5: column(8), pm10: column(15), us_aqi: column(35) },
};
const placeBody = { features: [{ geometry: { coordinates: [-86.236, 12.115] }, properties: { type: "city", name: "Managua", state: "Managua", country: "Nicaragua" } }] };

const json = (body: unknown) => new Response(JSON.stringify(body));
const failure = () => new Response("fallo", { status: 500 });

function stubSources({ weather = true, air = true }: { weather?: boolean; air?: boolean }) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("air-quality-api.open-meteo.com")) return air ? json(airBody) : failure();
    if (url.includes("api.open-meteo.com")) return weather ? json(weatherBody) : failure();
    return json(placeBody);
  }));
}

const call = (query: string) => GET(new Request(`http://localhost/api/point${query}`));

describe("GET /api/point", () => {
  it("rechaza la query sin lat/lon sin consultar fuentes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call("")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("entrega 72 horas de clima y aire con el nombre del lugar", async () => {
    stubSources({});
    const response = await call("?lat=12.115&lon=-86.236&lang=es");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=900");
    const body = await response.json();
    expect(body.place).toMatchObject({ name: "Managua", country: "Nicaragua" });
    expect(body.weather.time).toHaveLength(72);
    expect(body.weather.time[0]).toBe(START * 1000);
    expect(body.weather.windGusts[0]).toBe(25);
    expect(body.air.pm10[0]).toBe(15);
    expect(body.meta).toMatchObject({ horizonHours: 72, source: "network" });
  });

  it("si el aire falla responde 200 con el clima completo y air null", async () => {
    stubSources({ air: false });
    const response = await call("?lat=12.115&lon=-86.236");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=900");
    const body = await response.json();
    expect(body.air).toBeNull();
    expect(body.weather.time).toHaveLength(72);
    expect(body.current.temperature).toBe(27);
  });

  it("si el clima falla responde 200 sin cache", async () => {
    stubSources({ weather: false });
    const response = await call("?lat=12.115&lon=-86.236");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.current).toBeNull();
    expect(body.weather).toBeNull();
  });
});
