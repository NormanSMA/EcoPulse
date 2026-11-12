import { describe, expect, it } from "vitest";
import type { GridForecast } from "../forecast/types";
import type { CycloneFeature, EarthquakeFeature, FireFeature } from "../types";
import { buildPack, eventsInZone, MAX_EVENTS_PER_KIND, type LiveEvents } from "./buildPack";
import { tacticalZone } from "./grid";

const quake = (lon: number, lat: number, mag: number): EarthquakeFeature => ({
  type: "Feature",
  id: `${lon},${lat},${mag}`,
  properties: { mag, place: "", time: 0, updated: 0, url: "", alert: null, status: "", tsunami: 0, sig: 0 },
  geometry: { type: "Point", coordinates: [lon, lat, 10] },
});
const fire = (lon: number, lat: number): FireFeature =>
  ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lon, lat] } }) as unknown as FireFeature;
const cyclone = (coordinates: [number, number][]): CycloneFeature =>
  ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }) as unknown as CycloneFeature;

const empty: LiveEvents = { earthquakes: [], fires: [], disasters: [], cyclones: [], volcanoes: [] };
const zone = tacticalZone(-86.25, 12.1);

const forecast: GridForecast = {
  points: [{ id: "12.10,-86.25", lon: -86.25, lat: 12.1 }],
  time: [1000, 2000, 3000],
  weather: [],
  air: [],
  meta: { generatedAt: 1, horizonHours: 72, utcOffsetSeconds: 0, models: { weather: "open-meteo", air: "open-meteo-cams" }, source: "network" },
};

describe("eventsInZone", () => {
  it("filtra por caja con margen", () => {
    const out = eventsInZone(zone, { ...empty, fires: [fire(-86.25, 12.1), fire(-86.25, 12.9), fire(-86.25, 14.5)] }, 5);
    expect(out.fires).toHaveLength(2);
    expect(out.capturedAt).toBe(5);
  });
  it("ciclones de linea entran si algun vertice cae dentro", () => {
    const out = eventsInZone(zone, { ...empty, cyclones: [cyclone([[-60, 5], [-86.2, 12.2]]), cyclone([[-60, 5], [-61, 6]])] }, 0);
    expect(out.cyclones).toHaveLength(1);
  });
  it("limita por tipo y ordena sismos por magnitud", () => {
    const quakes = Array.from({ length: MAX_EVENTS_PER_KIND + 20 }, (_, i) => quake(-86.25, 12.1, i / 100));
    const out = eventsInZone(zone, { ...empty, earthquakes: quakes }, 0);
    expect(out.earthquakes).toHaveLength(MAX_EVENTS_PER_KIND);
    expect(out.earthquakes[0].properties.mag).toBeCloseTo((MAX_EVENTS_PER_KIND + 19) / 100);
  });
});

describe("buildPack", () => {
  const pack = buildPack(zone, forecast, { ...empty, fires: [fire(-86.25, 12.1)] }, { now: 9000, locale: "es" });
  it("llena metadatos", () => {
    expect(pack.meta).toMatchObject({
      id: zone.id,
      version: 1,
      createdAt: 9000,
      validFrom: 1000,
      validUntil: 3000,
      horizonHours: 72,
      pointCount: 1,
      eventCount: 1,
      locale: "es",
    });
    expect(pack.meta.sizeBytes).toBeGreaterThan(0);
  });
  it("marca el pronostico como pack", () => {
    expect(pack.forecast.meta.source).toBe("pack");
    expect(forecast.meta.source).toBe("network");
  });
});
