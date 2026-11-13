import { describe, expect, it } from "vitest";
import { altitudeToZoom, zoomToAltitude } from "./mapView";

describe("zoomToAltitude / altitudeToZoom", () => {
  it("son inversas entre sí (dentro del rango útil)", () => {
    for (const [lat, zoom, w, h] of [
      [12, 3.5, 1400, 860],
      [40, 6, 667, 873],
      [-33, 9.2, 390, 844],
    ]) {
      const alt = zoomToAltitude(lat, zoom, w, h);
      expect(altitudeToZoom(lat, alt, w, h)).toBeCloseTo(zoom, 6);
    }
  });

  it("da altitudes razonables: continente a zoom 3, ciudad a zoom 10", () => {
    expect(zoomToAltitude(12, 3, 1400, 860)).toBeGreaterThan(4e6);
    expect(zoomToAltitude(12, 3, 1400, 860)).toBeLessThan(1.5e7);
    expect(zoomToAltitude(12, 10, 1400, 860)).toBeLessThan(1.5e5);
  });

  it("en vertical usa el FOV del ancho (más estrecho): más altitud para el mismo zoom", () => {
    expect(zoomToAltitude(0, 4, 400, 800)).toBeGreaterThan(zoomToAltitude(0, 4, 400, 300) * 1.5);
  });

  it("no se aleja más allá de la vista global", () => {
    expect(zoomToAltitude(0, 0, 1400, 860)).toBe(2.5e7);
  });
});
