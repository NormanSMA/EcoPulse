import { describe, expect, it } from "vitest";
import {
  EARTH_RADIUS_KM, bboxAround, bboxContains, circleRing, expandBbox, haversineKm, kmToDeg, pointInPolygon, pointToSegmentKm,
} from "./geo";

describe("haversineKm", () => {
  it("Managua-San José ~345 km", () => {
    const d = haversineKm([-86.25, 12.13], [-84.08, 9.93]);
    expect(Math.abs(d - 345) / 345).toBeLessThan(0.02);
  });
  it("cruza el antimeridiano", () => {
    expect(haversineKm([179.5, 0], [-179.5, 0])).toBeCloseTo(111.2, 0);
  });
});

describe("pointToSegmentKm", () => {
  it("es 0 sobre el segmento", () => {
    expect(pointToSegmentKm([0, 2], [0, 0], [0, 5])).toBeCloseTo(0, 5);
  });
  it("usa el extremo si la proyección cae fuera", () => {
    expect(pointToSegmentKm([0, 10], [0, 0], [0, 5])).toBeCloseTo(haversineKm([0, 10], [0, 5]), 5);
  });
});

describe("circleRing", () => {
  const ring = circleRing(-86, 12, 100, 36);
  it("está cerrado", () => {
    expect(ring).toHaveLength(37);
    expect(ring[0][0]).toBeCloseTo(ring[36][0], 6);
    expect(ring[0][1]).toBeCloseTo(ring[36][1], 6);
  });
  it("respeta el radio", () => {
    for (const p of ring) expect(haversineKm([-86, 12], p)).toBeCloseTo(100, 3);
    expect(EARTH_RADIUS_KM).toBe(6371);
  });
});

describe("bbox", () => {
  it("contiene el centro y excluye lo lejano", () => {
    const box = bboxAround(-86, 12, 50);
    expect(bboxContains(box, -86, 12)).toBe(true);
    expect(bboxContains(box, -85, 12)).toBe(false);
    expect(box[3] - box[1]).toBeCloseTo(2 * kmToDeg(50), 6);
  });
  it("expandBbox agranda", () => {
    const box = bboxAround(-86, 12, 50);
    const bigger = expandBbox(box, 100);
    expect(bboxContains(bigger, -85, 12)).toBe(true);
    expect(bigger[3] - bigger[1]).toBeGreaterThan(box[3] - box[1]);
  });
});

describe("pointInPolygon", () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  it("detecta dentro y fuera", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });
});
