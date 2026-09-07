import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchModeledAirQuality } from "./openMeteoAirQuality";
import { CITY_ANCHORS } from "./cityAnchors";
import { getAQICategory } from "./openaq";

function makeEntry(pm25: number) {
  return { current: { time: "2026-09-07T02:00", pm2_5: pm25 } };
}

describe("fetchModeledAirQuality", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea la respuesta batch a una feature por ciudad ancla con categoria consistente", async () => {
    const mockResponse = CITY_ANCHORS.map((_, idx) => makeEntry(5 + idx * 10));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }));

    const result = await fetchModeledAirQuality();
    expect(result.features).toHaveLength(CITY_ANCHORS.length);
    expect(result.features[0].properties.city).toBe(CITY_ANCHORS[0].name);
    expect(result.features[0].properties.pm25).toBe(5);
    expect(result.features[0].properties.category).toBe(getAQICategory(5));
  });

  it("convierte el timestamp UTC sin sufijo Z a ISO 8601 valido", async () => {
    const mockResponse = CITY_ANCHORS.map(() => makeEntry(10));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }));

    const result = await fetchModeledAirQuality();
    expect(result.features[0].properties.updated).toBe("2026-09-07T02:00:00.000Z");
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchModeledAirQuality();
    expect(result.features).toEqual([]);
  });
});
