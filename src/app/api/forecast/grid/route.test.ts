import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, maxDuration } from "./route";
import { pickZone } from "@/lib/zones/pickZone";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HOURS = 72;
const START = 1_794_500_000;
const column = (value: number) => Array.from({ length: HOURS }, () => value);
const location = () => ({
  utc_offset_seconds: 0,
  hourly: {
    time: Array.from({ length: HOURS }, (_, i) => START + i * 3600),
    temperature_2m: column(27), apparent_temperature: column(30), relative_humidity_2m: column(70), surface_pressure: column(1010),
    cloud_cover: column(40), precipitation_probability: column(20), precipitation: column(0.5), wind_speed_10m: column(12),
    wind_direction_10m: column(90), wind_gusts_10m: column(25), uv_index: column(5), weather_code: column(2), is_day: column(1),
    pm2_5: column(8), pm10: column(15), us_aqi: column(35),
  },
});

/** Open-Meteo responde un objeto con 1 punto y un arreglo con varios. */
function stubOpenMeteo() {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const count = (new URL(String(input)).searchParams.get("latitude") ?? "").split(",").length;
    const body = count === 1 ? location() : Array.from({ length: count }, location);
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const call = (query: string) => GET(new Request(`http://localhost/api/forecast/grid${query}`));

describe("GET /api/forecast/grid", () => {
  it("declara un limite de duracion de 30 s", () => {
    expect(maxDuration).toBe(30);
  });

  it.each(["", "?zone=", "?zone=basura", "?zone=tactical:999,0", "?zone=metro:ni-inexistente", "?zone=country:ni&zone=country:ni", "?zone=country:ni&x=1", "?zone=tactical:012.10,-86.30", "?zone=tactical:12.1,-86.3", "?zone=%20country:ni", `?zone=${"x".repeat(80)}`])(
    "rechaza la zona invalida sin consultar Open-Meteo: %s",
    async (query) => {
      const fetchMock = stubOpenMeteo();
      const response = await call(query);
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("pide la malla del pais con una sola llamada por API y respeta el tope de puntos", async () => {
    const fetchMock = stubOpenMeteo();
    const response = await call("?zone=country:ni");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=1800");
    // Una llamada multi-coordenada de clima y una de aire: nunca una por punto.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const hosts = fetchMock.mock.calls.map(([url]) => new URL(String(url)).host).sort();
    expect(hosts).toEqual(["air-quality-api.open-meteo.com", "api.open-meteo.com"]);
    const body = await response.json();
    expect(body.zone.id).toBe("country:ni");
    expect(body.forecast.points.length).toBeGreaterThanOrEqual(17);
    expect(body.forecast.points.length).toBeLessThanOrEqual(80);
    expect(body.forecast.weather).toHaveLength(body.forecast.points.length);
    expect(body.forecast.time).toHaveLength(72);
    const weatherCall = fetchMock.mock.calls.map(([url]) => new URL(String(url))).find((url) => url.host === "api.open-meteo.com")!;
    expect(weatherCall.searchParams.get("latitude")!.split(",")).toHaveLength(body.forecast.points.length);
  });

  it("acepta zonas tacticas y metropolitanas por coordenada", async () => {
    stubOpenMeteo();
    const tactical = await (await call(`?zone=${encodeURIComponent(pickZone(-86.25, 12.13, 11).id)}`)).json();
    expect(tactical.zone.tier).toBe("tactical");
    expect(tactical.forecast.points.length).toBeLessThanOrEqual(36);
    const metro = await (await call(`?zone=${encodeURIComponent(pickZone(-84.09, 9.93, 8).id)}`)).json();
    expect(metro.zone.tier).toBe("metro");
    expect(metro.forecast.points.length).toBeLessThanOrEqual(64);
  });

  it("responde 500 sin cache cuando Open-Meteo falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("sin red")));
    const response = await call("?zone=country:ni");
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("pickZone", () => {
  it("elige el nivel segun el zoom", () => {
    expect(pickZone(-86.25, 12.13, 4).id).toBe("country:ni");
    expect(pickZone(-86.25, 12.13, 8).tier).toBe("metro");
    expect(pickZone(-86.25, 12.13, 11).tier).toBe("tactical");
  });

  it("lejos de Nicaragua usa una zona metropolitana", () => {
    expect(pickZone(2.35, 48.85, 4).tier).toBe("metro");
  });

  it("mover poco el mapa no cambia de zona", () => {
    expect(pickZone(-86.251, 12.131, 11).id).toBe(pickZone(-86.249, 12.129, 11).id);
  });
});
