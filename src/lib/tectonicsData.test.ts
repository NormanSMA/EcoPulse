import { describe, expect, it } from "vitest";
import { mergeSteps, ringCentroid, ringAreaKm2, buildPlates } from "../../scripts/tectonics-lib.mjs";

const step = (seq: number, cls: string, from: [number, number], to: [number, number], bound = "NZ-SA", len = 10, vel = 70) => ({
  SEQNUM: seq,
  STEPCLASS: cls,
  PLATEBOUND: bound,
  STARTLONG: from[0],
  STARTLAT: from[1],
  FINALLONG: to[0],
  FINALLAT: to[1],
  STEPLENGTH: len,
  VELOCITYLE: vel,
});

describe("mergeSteps", () => {
  it("une tramos contiguos del mismo límite y clase en una línea", () => {
    const out = mergeSteps([step(1, "SUB", [-72, -30], [-72, -31]), step(2, "SUB", [-72, -31], [-72, -32], "NZ-SA", 10, 80)]);
    expect(out).toHaveLength(1);
    expect(out[0].geometry.coordinates).toEqual([[-72, -30], [-72, -31], [-72, -32]]);
    expect(out[0].properties).toMatchObject({ plates: "NZ-SA", type: "convergent", lengthKm: 20, velocityMmYr: 75 });
  });

  it("separa al cambiar de clase y clasifica dorsales y transformantes", () => {
    const out = mergeSteps([step(1, "OSR", [0, 0], [0, 1], "AF-SA"), step(2, "OTF", [0, 1], [1, 1], "AF-SA")]);
    expect(out.map((f: { properties: { type: string } }) => f.properties.type)).toEqual(["divergent", "transform"]);
  });

  it("descarta el tramo que cruza el antimeridiano", () => {
    const out = mergeSteps([step(1, "OSR", [179, 0], [179.5, 0]), step(2, "OSR", [179.5, 0], [-179.8, 0]), step(3, "OSR", [-179.8, 0], [-179, 0])]);
    for (const f of out) {
      const lons = f.geometry.coordinates.map((c: number[]) => c[0]);
      expect(Math.max(...lons) - Math.min(...lons)).toBeLessThan(180);
    }
  });
});

describe("ringCentroid / ringAreaKm2", () => {
  it("calcula el centro de una placa que cruza el antimeridiano", () => {
    const [lon] = ringCentroid([[170, 0], [-170, 0], [-170, 10], [170, 10], [170, 0]]);
    expect(Math.abs(lon)).toBeGreaterThan(170);
  });

  it("da un área del orden correcto (1°x1° en el ecuador ≈ 12.300 km²)", () => {
    const a = ringAreaKm2([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    expect(a).toBeGreaterThan(12000);
    expect(a).toBeLessThan(12500);
  });
});

describe("buildPlates", () => {
  it("lista las placas vecinas a partir de los límites", () => {
    const plates = [{ properties: { Code: "NZ", PlateName: "Nazca" }, geometry: { type: "Polygon", coordinates: [[[-90, -10], [-80, -10], [-80, 0], [-90, 0], [-90, -10]]] } }];
    const out = buildPlates(plates, mergeSteps([step(1, "SUB", [-72, -30], [-72, -31])]));
    expect(out[0].properties).toMatchObject({ code: "NZ", name: "Nazca", neighbors: ["SA"] });
  });
});
