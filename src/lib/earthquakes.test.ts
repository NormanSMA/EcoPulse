import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMergedEarthquakes, fromEmsc, isSameEvent, loadMergedEarthquakes, mergeQuakes } from "./earthquakes";
import type { EarthquakeFeature } from "./types";

const usgs = (id: string, lon: number, lat: number, time: number, mag: number): EarthquakeFeature => ({
  type: "Feature",
  id,
  properties: { mag, place: "x", time, updated: time, url: "", alert: null, status: "reviewed", tsunami: 0, sig: 0 },
  geometry: { type: "Point", coordinates: [lon, lat, 10] },
});

const emscRaw = (unid: string, lon: number, lat: number, time: string, mag: number) => ({
  id: unid,
  geometry: { coordinates: [lon, lat, -35] as [number, number, number] },
  properties: {
    unid,
    time,
    lastupdate: time,
    flynn_region: "SOUTHERN GREECE",
    lat,
    lon,
    depth: 35,
    mag,
    magtype: "ml",
  },
});

describe("fromEmsc", () => {
  it("normaliza región, profundidad positiva y fuente", () => {
    const f = fromEmsc(emscRaw("20260923_1", 22.1, 37.2, "2026-09-23T10:00:00Z", 3.1));
    expect(f.properties.place).toBe("Southern Greece");
    expect(f.geometry.coordinates[2]).toBe(35);
    expect(f.properties.source).toBe("EMSC");
    expect(f.id).toBe("emsc-20260923_1");
  });
});

describe("mergeQuakes", () => {
  const t = Date.parse("2026-09-23T10:00:00Z");

  it("descarta el duplicado de EMSC y conserva el de USGS", () => {
    const merged = mergeQuakes(
      [usgs("us1", 22.1, 37.2, t, 4.5)],
      [fromEmsc(emscRaw("e1", 22.3, 37.3, "2026-09-23T10:00:20Z", 4.4))]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].properties.source).toBe("USGS");
  });

  it("agrega los sismos que USGS no tiene", () => {
    const merged = mergeQuakes([usgs("us1", -118, 34, t, 1.2)], [fromEmsc(emscRaw("e1", 22.3, 37.3, "2026-09-23T10:00:00Z", 3))]);
    expect(merged).toHaveLength(2);
  });

  it("no confunde sismos lejanos o separados en el tiempo", () => {
    const a = usgs("a", 0, 0, t, 3);
    expect(isSameEvent(a, usgs("b", 5, 5, t, 3))).toBe(false);
    expect(isSameEvent(a, usgs("c", 0, 0, t + 5 * 60_000, 3))).toBe(false);
  });
});

describe("loadMergedEarthquakes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lanza si ambas fuentes responden HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadMergedEarthquakes("day")).rejects.toThrow("USGS y EMSC no disponibles");
    expect((await fetchMergedEarthquakes("day")).features).toEqual([]);
  });

  it("lanza si fetch rechaza en ambas fuentes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("sin red")));
    await expect(loadMergedEarthquakes("week")).rejects.toThrow("USGS y EMSC no disponibles");
  });

  it("devuelve EMSC cuando USGS falla", async () => {
    const raw = emscRaw("e1", 22, 37, "2026-09-23T10:00:00Z", 3);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [raw] }) }));
    const result = await loadMergedEarthquakes("day");
    expect(result.features).toEqual([fromEmsc(raw)]);
    expect(result.metadata.count).toBe(1);
  });

  it("devuelve USGS cuando EMSC falla", async () => {
    const feature = usgs("us1", 22, 37, Date.now(), 3);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ features: [feature], metadata: { generated: 123 } }) })
      .mockRejectedValueOnce(new TypeError("sin red")));
    const result = await loadMergedEarthquakes("week");
    expect(result.features).toEqual([{ ...feature, properties: { ...feature.properties, source: "USGS" } }]);
    expect(result.metadata.generated).toBe(123);
  });

  it("acepta EMSC sin eventos aunque USGS falle", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new TypeError("sin red"))
      .mockResolvedValueOnce({ ok: true, status: 204 }));
    await expect(loadMergedEarthquakes("day")).resolves.toMatchObject({ features: [] });
  });

  it("relanza AbortError aunque la otra fuente responda", async () => {
    const error = new DOMException("cancelado", "AbortError");
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ ok: true, status: 204 }));
    await expect(loadMergedEarthquakes("day")).rejects.toBe(error);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(fetchMergedEarthquakes("day")).rejects.toBe(error);
  });
});
