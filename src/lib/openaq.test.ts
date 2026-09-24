import { describe, it, expect, vi, afterEach } from "vitest";
import { getAQICategory, fetchLiveAirQuality, fetchGlobalAirQuality } from "./openaq";

describe("getAQICategory", () => {
  it("clasifica como 'good' en el límite inferior y en 12.0", () => {
    expect(getAQICategory(0)).toBe("good");
    expect(getAQICategory(12.0)).toBe("good");
  });

  it("clasifica como 'moderate' justo sobre 12.0 y en el límite 35.4", () => {
    expect(getAQICategory(12.1)).toBe("moderate");
    expect(getAQICategory(35.4)).toBe("moderate");
  });

  it("clasifica como 'unhealthy' justo sobre 35.4 y en el límite 55.4", () => {
    expect(getAQICategory(35.5)).toBe("unhealthy");
    expect(getAQICategory(55.4)).toBe("unhealthy");
  });

  it("clasifica como 'hazardous' por encima de 55.4", () => {
    expect(getAQICategory(55.5)).toBe("hazardous");
    expect(getAQICategory(200)).toBe("hazardous");
  });
});

describe("fetchLiveAirQuality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sin OPENAQ_API_KEY devuelve vacío (nunca datos inventados)", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchLiveAirQuality();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.features).toEqual([]);
  });

  it("mapea estaciones reales cuando la API responde con una ubicacion y un sensor valido", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/locations")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              results: [
                {
                  id: 1,
                  name: "Estación Real",
                  coordinates: { latitude: 12.1, longitude: -86.2 },
                  sensors: [{ id: 999, parameter: { name: "pm25" } }],
                },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [{ latest: { value: 20, datetime: { utc: "" } } }] }),
        });
      })
    );

    const result = await fetchLiveAirQuality();
    expect(result.features.length).toBe(10);
    expect(result.features[0].properties.station).toBe("Estación Real");
    expect(result.features[0].properties.pm25).toBe(20);
    expect(result.features[0].properties.category).toBe("moderate");
  });

  it("filtra lecturas negativas y devuelve vacío si ninguna estación queda válida", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/locations")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              results: [
                {
                  id: 1,
                  name: "Estación Descalibrada",
                  coordinates: { latitude: 12.1, longitude: -86.2 },
                  sensors: [{ id: 999, parameter: { name: "pm25" } }],
                },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [{ latest: { value: -1, datetime: { utc: "" } } }] }),
        });
      })
    );

    const result = await fetchLiveAirQuality();
    expect(result.features).toEqual([]);
  });

  it("omite una ciudad sin estaciones cercanas sin fallar las demas", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/locations")) {
          return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
      })
    );

    const result = await fetchLiveAirQuality();
    expect(result.features).toEqual([]);
  });
});

describe("fetchGlobalAirQuality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("toma la lectura más reciente por estación y descarta valores imposibles", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "test-key");
    const row = (loc: number, value: number, utc: string) => ({
      datetime: { utc },
      value,
      coordinates: { latitude: 10, longitude: 20 },
      sensorsId: loc * 10,
      locationsId: loc,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          meta: { found: 4 },
          results: [
            row(1, 10, "2026-09-23T10:00:00Z"),
            row(1, 40, "2026-09-23T11:00:00Z"),
            row(2, -5, "2026-09-23T11:00:00Z"),
            row(3, 5000, "2026-09-23T11:00:00Z"),
          ],
        }),
      })
    );
    const result = await fetchGlobalAirQuality();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.pm25).toBe(40);
    expect(result.features[0].properties.category).toBe("unhealthy");
    expect(result.features[0].properties.updated).toBe("2026-09-23T11:00:00Z");
  });

  it("sin clave devuelve vacío", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "");
    expect((await fetchGlobalAirQuality()).features).toEqual([]);
  });
});
