import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/geo";
import {
  buildWindField,
  fieldToPoints,
  idwGrid,
  sampleWind,
  type WindField,
} from "./field";

const bbox: BBox = [0, 0, 2, 2];
const spec = { bbox, width: 3, height: 3 };
const f64 = (a: number[]) => Float64Array.from(a);

describe("idwGrid", () => {
  it("devuelve el valor exacto en un nodo", () => {
    const g = idwGrid(f64([0, 2]), f64([2, 0]), f64([10, 50]), spec);
    expect(g[0]).toBe(10);
    expect(g[8]).toBe(50);
  });

  it("un punto da valor constante", () => {
    const g = idwGrid(f64([0.3]), f64([0.7]), f64([7]), spec);
    for (const v of g) expect(v).toBeCloseTo(7);
  });

  it("dos puntos simetricos dan el promedio en el medio", () => {
    const g = idwGrid(f64([0, 2]), f64([1, 1]), f64([10, 30]), spec);
    expect(g[4]).toBeCloseTo(20);
  });

  it("sin puntos devuelve ceros", () => {
    const g = idwGrid(f64([]), f64([]), f64([]), spec);
    expect(Array.from(g)).toEqual(new Array(9).fill(0));
  });

  it("fila 0 es el norte", () => {
    const g = idwGrid(f64([1]), f64([2]), f64([5]), { ...spec, power: 2 });
    expect(g[1]).toBe(5);
    const h = idwGrid(f64([1, 1]), f64([2, 0]), f64([100, 0]), spec);
    expect(h[1]).toBe(100);
    expect(h[7]).toBe(0);
  });
});

describe("sampleWind", () => {
  const field: WindField = {
    u: Float32Array.from([0, 4, 0, 4]),
    v: Float32Array.from([0, 0, 8, 8]),
    width: 2,
    height: 2,
    bbox: [0, 0, 1, 1],
  };

  it("interpola bilineal en el centro", () => {
    const [u, v] = sampleWind(field, 0.5, 0.5);
    expect(u).toBeCloseTo(2);
    expect(v).toBeCloseTo(4);
  });

  it("fuera de la caja devuelve cero", () => {
    expect(sampleWind(field, 5, 5)).toEqual([0, 0]);
  });
});

describe("fieldToPoints", () => {
  it("respeta minValue", () => {
    const field = {
      values: Float32Array.from([1, 5, 9, 2]),
      width: 2,
      height: 2,
      bbox: [0, 0, 1, 1] as BBox,
    };
    const fc = fieldToPoints(field, 5);
    expect(fc.features.map((f) => f.properties?.value)).toEqual([5, 9]);
  });
});

describe("buildWindField", () => {
  it("null da ceros", () => {
    const w = buildWindField(null, spec);
    expect(w.u.every((x) => x === 0)).toBe(true);
    expect(w.v.every((x) => x === 0)).toBe(true);
    expect(w.u.length).toBe(9);
  });
});
