import { describe, expect, it } from "vitest";
import { nearestBoundary, plateName, pointToSegmentKm, splitPlates } from "./tectonics";
import type { TectonicBoundaryGeoJSON, TectonicPlateGeoJSON } from "./types";

const line = (id: string, plates: string, coordinates: [number, number][]) => ({
  type: "Feature" as const,
  properties: { id, plates, stepClass: "SUB" as const, type: "convergent" as const, lengthKm: 100, velocityMmYr: 50 },
  geometry: { type: "LineString" as const, coordinates },
});

const boundaries: TectonicBoundaryGeoJSON = {
  type: "FeatureCollection",
  features: [line("a", "NZ-SA", [[-72, -10], [-72, 10]]), line("b", "PA-NA", [[-120, 0], [-110, 0]])],
};

describe("pointToSegmentKm", () => {
  it("mide ~111 km por grado en el ecuador", () => {
    expect(pointToSegmentKm(1, 0, [0, -5], [0, 5])).toBeCloseTo(111.2, 0);
  });
  it("usa el extremo si la proyección cae fuera", () => {
    expect(pointToSegmentKm(0, 10, [0, 0], [0, 5])).toBeCloseTo(556, -1);
  });
  it("devuelve 0 sobre el segmento", () => {
    expect(pointToSegmentKm(0, 2, [0, 0], [0, 5])).toBeCloseTo(0, 5);
  });
  it("cruza el antimeridiano", () => {
    expect(pointToSegmentKm(-179.5, 0, [179.5, -5], [179.5, 5])).toBeCloseTo(111.2, 0);
  });
});

describe("nearestBoundary", () => {
  it("elige el límite más cercano", () => {
    const n = nearestBoundary(-71, 0, boundaries);
    expect(n?.plates).toBe("NZ-SA");
    expect(n?.distanceKm).toBeCloseTo(111.2, 0);
    expect(n?.type).toBe("convergent");
  });
  it("devuelve null sin datos", () => {
    expect(nearestBoundary(0, 0, null)).toBeNull();
    expect(nearestBoundary(0, 0, { type: "FeatureCollection", features: [] })).toBeNull();
  });
});

describe("plateName", () => {
  const plates: TectonicPlateGeoJSON = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { code: "NZ", name: "Nazca", areaKm2: 1, neighbors: [] }, geometry: { type: "Point", coordinates: [0, 0] } }],
  };
  it("resuelve el nombre o devuelve el código", () => {
    expect(plateName("NZ", plates)).toBe("Nazca");
    expect(plateName("XX", plates)).toBe("XX");
    expect(plateName("NZ", null)).toBe("NZ");
  });
});

describe("splitPlates", () => {
  it("separa los tres formatos de PB2002", () => {
    expect(splitPlates("NZ\\SA")).toEqual(["NZ", "SA"]);
    expect(splitPlates("CA/SA")).toEqual(["CA", "SA"]);
    expect(splitPlates("AF-AN")).toEqual(["AF", "AN"]);
  });
});
