import { describe, expect, it } from "vitest";
import { resolveSelection } from "./resolveSelection";
import type { MapData } from "@/components/map/types";

const fc = <T,>(features: T[]) => ({ type: "FeatureCollection" as const, features });

const data = {
  earthquakes: {
    ...fc([
      {
        type: "Feature",
        id: "us1",
        properties: { mag: 5, place: "x", time: 0, updated: 0, url: "", alert: null, status: "", tsunami: 0, sig: 0 },
        geometry: { type: "Point", coordinates: [10, 20, 33] },
      },
    ]),
    metadata: { generated: 0, url: "", title: "", status: 0, api: "", count: 1 },
  },
  fires: fc([
    { type: "Feature", id: "a", properties: { frp: 10, confidence: "high", satellite: "N", acquiredAt: "" }, geometry: { type: "Point", coordinates: [0, 0] } },
    { type: "Feature", id: "b", properties: { frp: 10, confidence: "high", satellite: "N", acquiredAt: "" }, geometry: { type: "Point", coordinates: [0.1, 0.1] } },
    { type: "Feature", id: "c", properties: { frp: 10, confidence: "high", satellite: "N", acquiredAt: "" }, geometry: { type: "Point", coordinates: [5, 5] } },
  ]),
  disasters: fc([]),
  cyclones: fc([]),
  volcanoes: fc([]),
  volcanoCatalog: null,
  airQuality: fc([]),
  iss: fc([]),
} as unknown as MapData;

describe("resolveSelection", () => {
  it("resuelve un sismo con sus coordenadas", () => {
    const r = resolveSelection({ kind: "quake", id: "us1" }, data);
    expect(r?.coords).toEqual([10, 20]);
    expect(r?.item.kind).toBe("quake");
  });

  it("cuenta los focos de incendio cercanos (<25 km)", () => {
    const r = resolveSelection({ kind: "fire", id: "a" }, data);
    expect(r?.item.kind === "fire" && r.item.nearby).toBe(1);
  });

  it("devuelve null si el elemento ya no existe", () => {
    expect(resolveSelection({ kind: "quake", id: "nope" }, data)).toBeNull();
  });

  it("un punto del mapa siempre se resuelve", () => {
    expect(resolveSelection({ kind: "point", lon: 1, lat: 2 }, data)?.coords).toEqual([1, 2]);
  });
});
