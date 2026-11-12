import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { GridForecast, GridPoint } from "../forecast/types";
import type { ZonePack } from "../zones/types";
import { resetDbForTests } from "./db";
import { deletePack, forecastFromPacks, getPack, isExpired, listPacks, nearestPoint, savePack } from "./packRepo";

const T0 = Date.UTC(2026, 0, 1);
const HOURS = 3;

function makePack(id: string, pts: (GridPoint & { air?: boolean })[], createdAt = 1000, validUntil = T0 + 1e9): ZonePack {
  const time = Array.from({ length: HOURS }, (_, i) => T0 + i * 3_600_000);
  const zeros = time.map(() => 0);
  const forecast: GridForecast = {
    points: pts.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, ...(p.label ? { label: p.label } : {}), ...(p.anchor ? { anchor: p.anchor } : {}) })),
    time,
    weather: pts.map((_, n) => ({
      temperature: time.map(() => 20 + n),
      apparentTemperature: zeros,
      humidity: zeros,
      surfacePressure: zeros,
      cloudCover: zeros,
      precipitationProbability: zeros,
      precipitation: zeros,
      windSpeed: zeros,
      windDirection: zeros,
      windGusts: zeros,
      uvIndex: zeros,
      weatherCode: zeros,
      isDay: time.map(() => true),
    })),
    air: pts.map((p, n) => (p.air ? { pm25: time.map(() => 10 + n), pm10: zeros, usAqi: zeros } : null)),
    meta: { generatedAt: T0, horizonHours: 72, utcOffsetSeconds: 0, models: { weather: "open-meteo", air: "open-meteo-cams" }, source: "network" },
  };
  return {
    meta: {
      id,
      zone: { id, tier: "tactical", name: `Zona ${id}`, bbox: [0, 0, 1, 1], center: [0, 0], stepDeg: 0.25, maxPoints: 10 },
      version: 1,
      createdAt,
      validFrom: T0,
      validUntil,
      horizonHours: 72,
      pointCount: pts.length,
      eventCount: 0,
      sizeBytes: 1,
      locale: "es",
    },
    forecast,
    events: { capturedAt: T0, earthquakes: [], fires: [], disasters: [], cyclones: [], volcanoes: [] },
  };
}

beforeEach(async () => {
  await resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("ecopulse");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe("packRepo", () => {
  it("guarda, lista, lee y borra", async () => {
    const a = makePack("a", [{ id: "p", lon: 0, lat: 0 }], 1000);
    const b = makePack("b", [{ id: "p", lon: 0, lat: 0 }], 2000);
    expect(await savePack(a)).toBe(true);
    expect(await savePack(b)).toBe(true);
    expect((await listPacks()).map((m) => m.id)).toEqual(["b", "a"]);
    expect(await getPack("a")).toEqual(a);
    expect(await deletePack("a")).toBe(true);
    expect(await getPack("a")).toBeNull();
    expect((await listPacks()).map((m) => m.id)).toEqual(["b"]);
  });

  it("reemplaza el paquete de la misma zona", async () => {
    await savePack(makePack("a", [{ id: "p", lon: 0, lat: 0 }], 1000));
    await savePack(makePack("a", [{ id: "q", lon: 1, lat: 1 }], 3000));
    const metas = await listPacks();
    expect(metas).toHaveLength(1);
    expect(metas[0].createdAt).toBe(3000);
    expect((await getPack("a"))?.forecast.points[0].id).toBe("q");
  });

  it("isExpired compara validUntil", () => {
    const meta = makePack("a", [], 1, 100).meta;
    expect(isExpired(meta, 101)).toBe(true);
    expect(isExpired(meta, 100)).toBe(false);
  });

  it("nearestPoint elige la distancia menor", () => {
    const pack = makePack("a", [{ id: "1", lon: 0, lat: 0 }, { id: "2", lon: 1, lat: 0 }]);
    const hit = nearestPoint(pack, 0.9, 0);
    expect(hit?.index).toBe(1);
    expect(hit?.distanceKm).toBeGreaterThan(10);
    expect(nearestPoint(makePack("e", []), 0, 0)).toBeNull();
  });

  it("forecastFromPacks respeta maxKm y paquetes vencidos", async () => {
    await savePack(makePack("a", [{ id: "1", lon: 0, lat: 0, label: "Centro", air: true }], 1000));
    const hit = await forecastFromPacks(0.01, 0, T0);
    expect(hit?.zone).toBe("Zona a");
    expect(hit?.forecast.place.name).toBe("Centro");
    expect(hit?.forecast.meta.source).toBe("pack");
    expect(hit?.forecast.current).toBeNull();
    expect(hit?.forecast.weather?.time).toHaveLength(HOURS);
    expect(hit?.forecast.air?.pm25[0]).toBe(10);
    expect(await forecastFromPacks(1, 0, T0)).toBeNull();
    expect(await forecastFromPacks(0.01, 0, T0 + 2e9)).toBeNull();
  });

  it("toma el aire del punto vecino", async () => {
    await savePack(
      makePack("a", [
        { id: "1", lon: 0, lat: 0 },
        { id: "2", lon: 0.25, lat: 0, air: true },
      ]),
    );
    const hit = await forecastFromPacks(0, 0, T0);
    expect(hit?.forecast.weather?.temperature[0]).toBe(20);
    expect(hit?.forecast.air?.pm25[0]).toBe(11);
  });

  it("aire lejano (más de 60 km) queda en null", async () => {
    await savePack(
      makePack("a", [
        { id: "1", lon: 0, lat: 0 },
        { id: "2", lon: 1, lat: 0, air: true },
      ]),
    );
    expect((await forecastFromPacks(0, 0, T0))?.forecast.air).toBeNull();
  });

  it("elige el punto más cercano entre paquetes", async () => {
    await savePack(makePack("a", [{ id: "1", lon: 0.1, lat: 0, label: "Lejos" }], 5000));
    await savePack(makePack("b", [{ id: "2", lon: 0.01, lat: 0, label: "Cerca" }], 1000));
    expect((await forecastFromPacks(0, 0, T0))?.forecast.place.name).toBe("Cerca");
  });
});
