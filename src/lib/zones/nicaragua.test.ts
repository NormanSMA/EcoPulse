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
  it("contorno cerrado con 120-260 vertices", () => {
    expect(NICARAGUA_OUTLINE[0]).toEqual(NICARAGUA_OUTLINE[NICARAGUA_OUTLINE.length - 1]);
    expect(NICARAGUA_OUTLINE.length).toBeGreaterThanOrEqual(120);
    expect(NICARAGUA_OUTLINE.length).toBeLessThanOrEqual(260);
  });
  it("contorno sin autointersecciones", () => {
    const r = NICARAGUA_OUTLINE;
    const n = r.length - 1;
    const orient = (a: number[], b: number[], c: number[]) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const crosses =
          orient(r[i], r[i + 1], r[j]) !== orient(r[i], r[i + 1], r[j + 1]) &&
          orient(r[j], r[j + 1], r[i]) !== orient(r[j], r[j + 1], r[i + 1]);
        expect(crosses, `aristas ${i} y ${j}`).toBe(false);
      }
    }
  });
  it("puntos lejanos o en el mar dan false", () => {
    expect(inNicaragua(-87.21, 14.07)).toBe(false); // Tegucigalpa
    expect(inNicaragua(-84.09, 9.93)).toBe(false); // San Jose de Costa Rica
    expect(inNicaragua(-88.0, 12.3)).toBe(false); // Pacifico, ~30 km de la costa
  });
  it("departmentAt", () => {
    expect(departmentAt(-86.25, 12.14)?.id).toBe("ni-managua");
    expect(departmentAt(-60, 0)).toBeNull();
  });
});
