import { describe, expect, it } from "vitest";
import { nearestCandidate, pixelToSegment, type Pixel } from "./screenPick";

describe("pixelToSegment", () => {
  it("punto-punto cuando a === b", () => {
    expect(pixelToSegment([3, 4], [0, 0], [0, 0])).toBe(5);
  });
  it("proyecta dentro del segmento", () => {
    expect(pixelToSegment([5, 3], [0, 0], [10, 0])).toBe(3);
  });
  it("limita a los extremos", () => {
    expect(pixelToSegment([13, 4], [0, 0], [10, 0])).toBe(5);
    expect(pixelToSegment([-3, 4], [0, 0], [10, 0])).toBe(5);
  });
});

describe("nearestCandidate", () => {
  const c: Pixel = [50, 50];
  it("elige el mas cercano dentro del limite", () => {
    const r = nearestCandidate(c, [
      { item: "lejos", line: [[60, 50]] },
      { item: "cerca", line: [[52, 50]] },
    ], 24);
    expect(r).toBe("cerca");
  });
  it("detecta polilineas por segmento", () => {
    expect(nearestCandidate(c, [{ item: "linea", line: [[0, 52], [100, 52]] }], 24)).toBe("linea");
  });
  it("devuelve null fuera del limite o sin candidatos", () => {
    expect(nearestCandidate(c, [{ item: "x", line: [[100, 100]] }], 24)).toBeNull();
    expect(nearestCandidate(c, [], 24)).toBeNull();
  });
  it("ignora vertices sin proyeccion", () => {
    expect(nearestCandidate(c, [{ item: "x", line: [[0, 50], undefined, [100, 50]] }], 24)).toBeNull();
    expect(nearestCandidate(c, [{ item: "x", line: [undefined] }], 24)).toBeNull();
  });
  it("en empate gana el ultimo", () => {
    const r = nearestCandidate(c, [{ item: "a", line: [[52, 50]] }, { item: "b", line: [[48, 50]] }], 24);
    expect(r).toBe("b");
  });
});
