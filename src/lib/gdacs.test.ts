import { describe, it, expect, vi, afterEach } from "vitest";
import { toDisasterFeature, fetchLiveDisasters, isRecentDisaster } from "./gdacs";

const floodRaw = {
  geometry: { type: "Point", coordinates: [116.0, 28.0] as [number, number] },
  properties: {
    eventid: 1104081,
    eventtype: "FL",
    name: "Flood in China",
    country: "China",
    alertlevel: "Orange",
    fromdate: "2026-07-31T01:00:00",
    todate: "2026-09-07T01:00:00",
    url: { report: "https://www.gdacs.org/report.aspx?eventid=1104081" },
  },
};

const earthquakeRaw = {
  geometry: { type: "Point", coordinates: [-70, -20] as [number, number] },
  properties: {
    eventid: 555,
    eventtype: "EQ",
    name: "Earthquake somewhere",
    country: "Chile",
    alertlevel: "Green",
    fromdate: "2026-09-01T00:00:00",
    todate: "2026-09-01T00:00:00",
    url: { report: "https://www.gdacs.org/report.aspx?eventid=555" },
  },
};

describe("toDisasterFeature", () => {
  it("mapea un evento de inundacion a una feature GeoJSON", () => {
    const feature = toDisasterFeature(floodRaw);
    expect(feature).not.toBeNull();
    expect(feature?.properties.eventType).toBe("FL");
    expect(feature?.properties.eventTypeLabel).toBe("Inundación");
    expect(feature?.properties.alertLevel).toBe("Orange");
    expect(feature?.id).toBe("FL-1104081");
    expect(feature?.geometry.coordinates).toEqual([116.0, 28.0]);
  });

  it("descarta eventos de tipo EQ/WF para no duplicar sismos e incendios", () => {
    expect(toDisasterFeature(earthquakeRaw)).toBeNull();
  });

  it("descarta geometrias que no son Point", () => {
    const polygonRaw = { ...floodRaw, geometry: { type: "Polygon", coordinates: [] as unknown as [number, number] } };
    expect(toDisasterFeature(polygonRaw)).toBeNull();
  });
});

describe("fetchLiveDisasters", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("filtra solo los tipos incluidos de una respuesta real de GDACS", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [floodRaw, earthquakeRaw] }),
      })
    );

    const result = await fetchLiveDisasters();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.eventType).toBe("FL");
    vi.useRealTimers();
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchLiveDisasters();
    expect(result.features).toEqual([]);
  });
});

describe("isRecentDisaster", () => {
  const now = Date.parse("2026-09-23T00:00:00Z");
  it("descarta eventos cerrados hace más de 14 días", () => {
    expect(isRecentDisaster(floodRaw, now)).toBe(false);
  });
  it("acepta eventos cerrados hace poco", () => {
    expect(isRecentDisaster({ ...floodRaw, properties: { ...floodRaw.properties, todate: "2026-09-20T00:00:00" } }, now)).toBe(true);
  });
  it("acepta siempre los que GDACS marca como actuales", () => {
    expect(isRecentDisaster({ ...floodRaw, properties: { ...floodRaw.properties, iscurrent: "true" } }, now)).toBe(true);
  });
});
