import { describe, expect, it } from "vitest";
import { unwrapLongitudes, footprintRadiusKm, subsolarPoint, nightPolygon } from "./geoShapes";

describe("unwrapLongitudes", () => {
  it("mantiene la línea continua al cruzar el antimeridiano", () => {
    expect(unwrapLongitudes([[178, 0], [-179, 1], [-176, 2]])).toEqual([[178, 0], [181, 1], [184, 2]]);
  });
});

describe("footprintRadiusKm", () => {
  it("da ~1.400 km para la ISS a 420 km con 10° de elevación", () => {
    const r = footprintRadiusKm(420);
    expect(r).toBeGreaterThan(1300);
    expect(r).toBeLessThan(1500);
  });
});

describe("subsolarPoint", () => {
  it("sitúa el sol sobre el trópico de Cáncer en el solsticio de junio a mediodía UTC", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0)));
    expect(p.lat).toBeGreaterThan(23);
    expect(p.lat).toBeLessThan(23.6);
    expect(Math.abs(p.lon)).toBeLessThan(3);
  });
});

describe("nightPolygon", () => {
  it("cierra por el polo sur en verano boreal (noche polar austral)", () => {
    const ring = nightPolygon(new Date(Date.UTC(2026, 5, 21, 12, 0)));
    expect(ring.some(([, lat]) => lat === -90)).toBe(true);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
