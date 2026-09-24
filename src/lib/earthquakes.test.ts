import { describe, expect, it } from "vitest";
import { fromEmsc, isSameEvent, mergeQuakes } from "./earthquakes";
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
