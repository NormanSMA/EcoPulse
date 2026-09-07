import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLiveWeather, describeWeatherCode } from "./weather";
import { CITY_ANCHORS } from "./cityAnchors";

function makeEntry(temp: number, code: number) {
  return {
    latitude: 0,
    longitude: 0,
    current: {
      time: "2026-09-07T01:15",
      temperature_2m: temp,
      relative_humidity_2m: 79,
      wind_speed_10m: 17.8,
      wind_direction_10m: 146,
      weather_code: code,
    },
  };
}

describe("describeWeatherCode", () => {
  it("traduce codigos WMO conocidos", () => {
    expect(describeWeatherCode(0)).toBe("Despejado");
    expect(describeWeatherCode(61)).toBe("Lluvia ligera");
    expect(describeWeatherCode(95)).toBe("Tormenta eléctrica");
  });

  it("devuelve un texto de respaldo para codigos desconocidos", () => {
    expect(describeWeatherCode(9999)).toBe("Condición desconocida");
  });
});

describe("fetchLiveWeather", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea la respuesta batch de Open-Meteo a una feature por ciudad ancla", async () => {
    const mockResponse = CITY_ANCHORS.map((_, idx) => makeEntry(20 + idx, 0));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }));

    const result = await fetchLiveWeather();
    expect(result.features).toHaveLength(CITY_ANCHORS.length);
    expect(result.features[0].properties.city).toBe(CITY_ANCHORS[0].name);
    expect(result.features[0].properties.temperature).toBe(20);
    expect(result.features[0].geometry.coordinates).toEqual([CITY_ANCHORS[0].lon, CITY_ANCHORS[0].lat]);
  });

  it("convierte el timestamp UTC sin sufijo Z a ISO 8601 valido", async () => {
    const mockResponse = CITY_ANCHORS.map(() => makeEntry(25, 3));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }));

    const result = await fetchLiveWeather();
    expect(result.features[0].properties.updated).toBe("2026-09-07T01:15:00.000Z");
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchLiveWeather();
    expect(result.features).toEqual([]);
  });
});
