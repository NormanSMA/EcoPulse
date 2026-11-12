import { describe, expect, it } from "vitest";
import { bboxContains } from "../geo";
import { CAPITALS, DEPARTMENTS, departmentAt, inNicaragua, NICARAGUA_BBOX, NICARAGUA_OUTLINE } from "./nicaragua";

describe("catalogo de Nicaragua", () => {
  it("tiene 17 departamentos y cabeceras", () => {
    expect(DEPARTMENTS).toHaveLength(17);
    expect(CAPITALS).toHaveLength(17);
  });
  it("cada cabecera esta dentro del contorno y de su caja", () => {
    for (const d of DEPARTMENTS) {
      expect(inNicaragua(d.capitalLon, d.capitalLat), d.capital).toBe(true);
      expect(bboxContains(d.bbox, d.capitalLon, d.capitalLat), d.capital).toBe(true);
    }
  });
  it("cada caja cabe en NICARAGUA_BBOX con tolerancia 0.2", () => {
    const [w, s, e, n] = NICARAGUA_BBOX;
    for (const d of DEPARTMENTS) {
      expect(d.bbox[0]).toBeGreaterThanOrEqual(w - 0.2);
      expect(d.bbox[1]).toBeGreaterThanOrEqual(s - 0.2);
      expect(d.bbox[2]).toBeLessThanOrEqual(e + 0.2);
      expect(d.bbox[3]).toBeLessThanOrEqual(n + 0.2);
    }
  });
  it("inNicaragua", () => {
    expect(inNicaragua(-86.25, 12.14)).toBe(true);
    expect(inNicaragua(-84.09, 9.93)).toBe(false);
    expect(inNicaragua(-87.21, 14.07)).toBe(false);
  });
  it("contorno cerrado con 40-70 vertices", () => {
    expect(NICARAGUA_OUTLINE[0]).toEqual(NICARAGUA_OUTLINE[NICARAGUA_OUTLINE.length - 1]);
    expect(NICARAGUA_OUTLINE.length).toBeGreaterThanOrEqual(40);
    expect(NICARAGUA_OUTLINE.length).toBeLessThanOrEqual(70);
  });
  it("departmentAt", () => {
    expect(departmentAt(-86.25, 12.14)?.id).toBe("ni-managua");
    expect(departmentAt(-60, 0)).toBeNull();
  });
});
