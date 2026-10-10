import { describe, expect, it } from "vitest";
import { buildWidgetSummary } from "./widget";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const quake = (id: string, mag: number, lon: number, lat: number, hoursAgo = 1) =>
  ({
    type: "Feature",
    id,
    properties: { mag, place: `lugar ${id}`, time: NOW - hoursAgo * 3_600_000 },
    geometry: { type: "Point", coordinates: [lon, lat, 10] },
  }) as never;

const empty = { cyclones: [], volcanoes: [], disasters: [] };

describe("buildWidgetSummary", () => {
  it("resume los sismos de las últimas 24 h y elige el más fuerte", () => {
    const s = buildWidgetSummary({ ...empty, quakes: [quake("a", 4.2, 0, 0), quake("b", 6.1, 10, 10), quake("c", 7.5, 0, 0, 30)] }, "https://app", NOW);
    expect(s.quakes.count24h).toBe(2);
    expect(s.quakes.countM5).toBe(1);
    expect(s.quakes.strongest).toMatchObject({ mag: 6.1, place: "lugar b", depthKm: 10, url: "https://app/?sel=eq-b" });
  });

  it("encuentra el sismo M ≥ 4 más cercano a la ubicación", () => {
    const s = buildWidgetSummary({ ...empty, quakes: [quake("lejos", 6, 50, 50), quake("cerca", 4.5, -86.3, 12.2), quake("chico", 3, -86.2, 12.1)] }, "https://app", NOW, { lat: 12.1, lon: -86.2 });
    expect(s.quakes.nearest?.place).toBe("lugar cerca");
    expect(s.quakes.nearest?.distanceKm).toBeLessThan(20);
  });

  it("sin sismos cercanos devuelve null", () => {
    const s = buildWidgetSummary({ ...empty, quakes: [quake("lejos", 6, 50, 50)] }, "https://app", NOW, { lat: 12, lon: -86 });
    expect(s.quakes.nearest).toBeNull();
  });
});
