import { describe, expect, it } from "vitest";
import { entityIdFor, selectionFromEntityId, type Selection } from "./selection";

describe("selection ids", () => {
  const cases: Selection[] = [
    { kind: "quake", id: "us7000abcd" },
    { kind: "quake", id: "emsc-20260923_1" },
    { kind: "fire", id: "123-VIIRS" },
    { kind: "disaster", id: "FL-1104081" },
    { kind: "cyclone", id: "TC-1001326" },
    { kind: "volcano", id: 262000 },
    { kind: "volcanoCatalog", id: 211060 },
    { kind: "air", id: 43487 },
    { kind: "iss" },
  ];
  it.each(cases)("ida y vuelta para %o", (s) => {
    expect(selectionFromEntityId(entityIdFor(s)!)).toEqual(s);
  });
  it("ignora ids desconocidos (trayectorias, conos)", () => {
    expect(selectionFromEntityId("iss-track-past")).toBeNull();
    expect(selectionFromEntityId("cyc-geo-cone-TC-1-0")).toBeNull();
  });
});
