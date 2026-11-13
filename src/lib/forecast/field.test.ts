import { describe, expect, it } from "vitest";
import type { BBox } from "@/lib/geo";
import type { WeatherFrame } from "./types";
import {
  buildFrameFields,
  buildWindField,
  fieldToPoints,
  idwGrid,
  sampleWind,
  smoothInPlace,
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

describe("buildFrameFields", () => {
  const point: WeatherFrame["features"][number] = {
    lon: -86, lat: 12, u: 15, v: -20, windSpeed: 25, windDirection: 320,
    windGusts: 30, cloudCover: 80, precipitation: 1.2,
    precipitationProbability: null, temperature: 28,
  };
  const frame = (features: WeatherFrame["features"]): WeatherFrame => ({ time: 0, features });

  it("devuelve null sin cuadro o sin puntos", () => {
    expect(buildFrameFields(null)).toBeNull();
    expect(buildFrameFields(frame([]))).toBeNull();
  });

  it("expande un punto y conserva sus valores en los campos", () => {
    const fields = buildFrameFields(frame([point]));
    expect(fields?.bbox).toEqual([-86.25, 11.75, -85.75, 12.25]);
    expect(fields?.wind.width).toBe(96);
    expect(fields?.wind.height).toBe(96);
    expect(fields?.cellDeg).toBeCloseTo(0.5 / 96);
    expect(fields?.wind.u.every((value) => value === 15)).toBe(true);
    expect(fields?.wind.v.every((value) => value === -20)).toBe(true);
    expect(fields?.clouds.values.every((value) => value === 80)).toBe(true);
    expect(fields?.rain.values[0]).toBeCloseTo(1.2);
  });

  it("contiene varios puntos y comparte dimensiones entre campos", () => {
    const points = [point, { ...point, lon: -84, lat: 14 }];
    const fields = buildFrameFields(frame(points), 48);
    expect(fields).not.toBeNull();
    if (!fields) return;
    expect(fields.bbox).toEqual([-86.25, 11.75, -83.75, 14.25]);
    for (const field of [fields.wind, fields.clouds, fields.rain]) {
      expect(field.width).toBe(48);
      expect(field.height).toBe(48);
      expect(field.bbox).toEqual(fields.bbox);
    }
    for (const { lon, lat } of points) {
      expect(lon).toBeGreaterThan(fields.bbox[0]);
      expect(lon).toBeLessThan(fields.bbox[2]);
      expect(lat).toBeGreaterThan(fields.bbox[1]);
      expect(lat).toBeLessThan(fields.bbox[3]);
    }
    expect(fields.cellDeg).toBeCloseTo(2.5 / 48);
  });

  it.each(["horizontal", "vertical"])("ajusta una caja %s y limita dimensiones", (direction) => {
    const far = direction === "horizontal" ? { ...point, lon: 80 } : { ...point, lat: 80 };
    const fields = buildFrameFields(frame([point, far]), 200);
    expect(fields).not.toBeNull();
    if (!fields) return;
    expect(fields.wind.width).toBe(direction === "horizontal" ? 128 : 24);
    expect(fields.wind.height).toBe(direction === "horizontal" ? 24 : 128);
    expect(fields.bbox[0]).toBeLessThan(Math.min(point.lon, far.lon));
    expect(fields.bbox[2]).toBeGreaterThan(Math.max(point.lon, far.lon));
    expect(fields.bbox[1]).toBeLessThan(Math.min(point.lat, far.lat));
    expect(fields.bbox[3]).toBeGreaterThan(Math.max(point.lat, far.lat));
    expect(fields.cellDeg).toBeCloseTo(Math.max(
      (fields.bbox[2] - fields.bbox[0]) / fields.wind.width,
      (fields.bbox[3] - fields.bbox[1]) / fields.wind.height,
    ));
  });
});

describe("smoothInPlace", () => {
  it("conserva un campo constante", () => {
    const values = new Float32Array(25).fill(7);
    smoothInPlace(values, 5, 5, 2);
    for (const value of values) expect(value).toBeCloseTo(7, 5);
  });

  it("reparte un pico sin superar su valor original", () => {
    const values = new Float32Array(25);
    values[12] = 100;
    smoothInPlace(values, 5, 5, 1);
    expect(Math.max(...values)).toBeLessThan(100);
    expect(values[11]).toBeGreaterThan(0);
  });

  it("radio 0 no cambia nada", () => {
    const values = new Float32Array([1, 2, 3, 4]);
    smoothInPlace(values, 2, 2, 0);
    expect(Array.from(values)).toEqual([1, 2, 3, 4]);
  });
});
