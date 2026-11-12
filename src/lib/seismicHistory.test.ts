import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSeismicHistory, parseSeismicHistoryQuery } from "./seismicHistory";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const parse = (query: string) => parseSeismicHistoryQuery(new URLSearchParams(query));

describe("parseSeismicHistoryQuery", () => {
  it("usa point por defecto con lat/lon y aplica valores por defecto", () => {
    expect(parse("lat=-33.4&lon=-70.6")).toEqual({ mode: "point", lat: -33.4, lon: -70.6, radiusKm: 150, days: 30 });
  });

  it("acepta radiusKm y days dentro de rango", () => {
    expect(parse("mode=point&lat=1&lon=2&radiusKm=500&days=1")).toMatchObject({ radiusKm: 500, days: 1 });
  });

  it.each([
    "", "lat=1", "lat=91&lon=0", "lat=1&lon=2&radiusKm=0", "lat=1&lon=2&radiusKm=501",
    "lat=1&lon=2&days=0", "lat=1&lon=2&days=31", "lat=1&lon=2&days=abc", "mode=otro&lat=1&lon=2",
  ])("rechaza point inválido: %s", (query) => {
    expect(parse(query)).toBeNull();
  });

  it("usa boundary por defecto con plates y normaliza el orden", () => {
    expect(parse("plates=NZ-SA")).toEqual({ mode: "boundary", plates: "NZ-SA" });
    expect(parse("mode=boundary&plates=SA-NZ")).toEqual({ mode: "boundary", plates: "NZ-SA" });
  });

  it.each(["mode=boundary", "mode=boundary&plates=ZZ-SA", "plates=NZ-SA&plates=SA-NZ"])(
    "rechaza boundary inválido: %s", (query) => {
      expect(parse(query)).toBeNull();
    },
  );
});

describe("loadSeismicHistory", () => {
  const usgsEvent = (id: string, mag: number) => ({ type: "Feature", id,
    properties: { mag, time: Date.parse("2015-09-16T22:54:32Z"), place: "Chile", url: "https://earthquake.usgs.gov/" },
    geometry: { type: "Point", coordinates: [-71.6744, -31.5729, 22.4] } });

  it("modo point devuelve features sin summary", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("earthquake.usgs.gov")
      ? { ok: true, status: 200, json: async () => ({ features: [usgsEvent("a", 4)] }) }
      : { ok: true, status: 204 }));
    const history = await loadSeismicHistory({ mode: "point", lat: -31.5, lon: -71.6, radiusKm: 100, days: 10 });
    expect(history.features).toHaveLength(1);
    expect(history.summary).toBeUndefined();
    expect(history.metadata).toMatchObject({ mode: "point", sources: ["USGS", "EMSC"], radiusKm: 100, minMagnitude: 2.5, count: 1 });
  });

  it("modo boundary convergente informa radiusKm 250", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ features: [usgsEvent("chile-2015", 8.3)] }) }));
    const history = await loadSeismicHistory({ mode: "boundary", plates: "NZ-SA" });
    expect(history.metadata).toMatchObject({ mode: "boundary", plates: "NZ-SA", sources: ["USGS"], radiusKm: 250, count: 1 });
    expect(history.summary?.total).toBe(1);
  });

  it("modo boundary no convergente informa radiusKm 100", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, ok: true }));
    const history = await loadSeismicHistory({ mode: "boundary", plates: "AF-AN" });
    expect(history.metadata.radiusKm).toBe(100);
    expect(history.features).toEqual([]);
  });
});
