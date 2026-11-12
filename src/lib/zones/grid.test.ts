import { describe, expect, it } from "vitest";
import { bboxContains } from "../geo";
import { airEveryFor, countryZone, gridPoints, metroZone, snap, tacticalZone, zoneFromId } from "./grid";

describe("snap", () => {
  it("ajusta sin ruido de coma flotante", () => {
    expect(snap(12.13, 0.05)).toBe(12.15);
    expect(snap(-86.2362, 0.1)).toBe(-86.2);
    expect(snap(0.3, 0.1)).toBe(0.3);
  });
});

describe("zonas", () => {
  it("tactica: id con centro ajustado", () => {
    const z = tacticalZone(-86.2362, 12.115);
    expect(z.id).toBe("tactical:12.10,-86.25");
    expect(z.center).toEqual([-86.25, 12.1]);
  });
  it("metro dentro de Nicaragua usa el departamento", () => {
    const z = metroZone(-86.25, 12.14);
    expect(z.id).toBe("metro:ni-managua");
    expect(z.name).toBe("Managua");
  });
  it("metro fuera de Nicaragua usa caja de 100 km", () => {
    const z = metroZone(-84.09, 9.93);
    expect(z.id).toBe("metro:9.9,-84.1");
  });
  it("airEvery por nivel", () => {
    expect(airEveryFor(tacticalZone(0, 0))).toBe(4);
    expect(airEveryFor(metroZone(0, 0))).toBe(2);
    expect(airEveryFor(countryZone())).toBe(1);
  });
});

describe("gridPoints", () => {
  const zones = [tacticalZone(-86.25, 12.1), metroZone(-86.25, 12.14), metroZone(-84.09, 9.93), countryZone(), tacticalZone(10, 70)];
  it("respeta conteos y tope", () => {
    const [t, m, mo, c, tHigh] = zones.map((z) => gridPoints(z));
    expect(t.length).toBeGreaterThanOrEqual(25);
    expect(t.length).toBeLessThanOrEqual(36);
    expect(tHigh.length).toBeLessThanOrEqual(36);
    expect(m.length).toBeLessThanOrEqual(64);
    expect(mo.length).toBe(64);
    expect(mo.length).toBeLessThanOrEqual(64);
    expect(c.length).toBeLessThanOrEqual(80);
    expect(c.length).toBeGreaterThan(17);
  });
  it("todos los puntos caen dentro de la caja y en la reticula", () => {
    for (const z of zones) {
      for (const p of gridPoints(z)) {
        expect(bboxContains(z.bbox, p.lon, p.lat), `${z.id} ${p.id}`).toBe(true);
        if (!p.anchor) {
          expect(Math.abs(p.lon / z.stepDeg - Math.round(p.lon / z.stepDeg))).toBeLessThan(1e-6);
          expect(Math.abs(p.lat / z.stepDeg - Math.round(p.lat / z.stepDeg))).toBeLessThan(1e-6);
        }
      }
    }
  });
  it("es determinista y ordenado sur a norte", () => {
    const a = gridPoints(countryZone());
    expect(gridPoints(countryZone())).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i].lat).toBeGreaterThanOrEqual(a[i - 1].lat);
  });
  it("zonas tacticas vecinas comparten ids", () => {
    const a = new Set(gridPoints(tacticalZone(-86.25, 12.1)).map((p) => p.id));
    const shared = gridPoints(tacticalZone(-86.15, 12.1)).filter((p) => a.has(p.id));
    expect(shared.length).toBeGreaterThan(0);
  });
  it("metro de departamento incluye la cabecera como ancla", () => {
    const anchors = gridPoints(metroZone(-86.25, 12.14)).filter((p) => p.anchor);
    expect(anchors.map((p) => p.label)).toEqual(["Managua"]);
  });
  it("country tiene 17 anclas", () => {
    expect(gridPoints(countryZone()).filter((p) => p.anchor)).toHaveLength(17);
  });
});

describe("zoneFromId", () => {
  it("reproduce la zona en los tres niveles", () => {
    for (const z of [tacticalZone(-86.25, 12.1), metroZone(-86.25, 12.14), metroZone(-84.09, 9.93), countryZone()]) {
      expect(zoneFromId(z.id)).toEqual(z);
    }
  });
  it("rechaza ids invalidos", () => {
    for (const id of ["", "x:1,2", "tactical:999,0", "metro:ni-inexistente", "tactical:0,181"]) {
      expect(zoneFromId(id), id).toBeNull();
    }
  });
});
