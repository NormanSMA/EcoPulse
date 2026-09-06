import { describe, it, expect, vi, afterEach } from "vitest";
import { getAQICategory, mockAirQualityGeoJSON, fetchLiveAirQuality } from "./openaq";

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

describe("mockAirQualityGeoJSON", () => {
  it("devuelve una FeatureCollection con la forma esperada", () => {
    const result = mockAirQualityGeoJSON();
    expect(result.type).toBe("FeatureCollection");
    expect(result.features.length).toBeGreaterThan(0);
  });

  it("cada feature tiene coordenadas [lng, lat] y categoría consistente con su pm25", () => {
    const result = mockAirQualityGeoJSON();
    for (const feature of result.features) {
      expect(feature.type).toBe("Feature");
      expect(feature.geometry.type).toBe("Point");
      expect(feature.geometry.coordinates).toHaveLength(2);
      expect(feature.properties.category).toBe(getAQICategory(feature.properties.pm25));
    }
  });
});

describe("fetchLiveAirQuality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("cae al mock si no hay OPENAQ_API_KEY configurada", async () => {
    vi.stubEnv("OPENAQ_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchLiveAirQuality();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.type).toBe("FeatureCollection");
    expect(result.features.map((f) => f.properties.station)).toEqual(
      mockAirQualityGeoJSON().features.map((f) => f.properties.station)
    );
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

  it("filtra lecturas negativas y cae al mock si ninguna estacion queda valida", async () => {
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
    expect(result.features.map((f) => f.properties.station)).toEqual(
      mockAirQualityGeoJSON().features.map((f) => f.properties.station)
    );
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
    expect(result.features.map((f) => f.properties.station)).toEqual(
      mockAirQualityGeoJSON().features.map((f) => f.properties.station)
    );
  });
});
