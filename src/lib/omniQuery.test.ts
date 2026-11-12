import { describe, expect, it } from "vitest";
import { parseOmniQuery, RADIUS_LIMITS } from "./omniQuery";

describe("parseOmniQuery", () => {
  it("texto vacio", () => {
    expect(parseOmniQuery("")).toEqual({ kind: "empty" });
    expect(parseOmniQuery("   ")).toEqual({ kind: "empty" });
  });
  it("lugar simple", () => {
    expect(parseOmniQuery("  Managua ")).toEqual({ kind: "place", text: "Managua" });
  });
  it("solo radio es here", () => {
    expect(parseOmniQuery("@50km")).toEqual({ kind: "here", radiusKm: 50 });
    expect(parseOmniQuery("@ 50 KM")).toEqual({ kind: "here", radiusKm: 50 });
  });
  it("radio con lugar, sin km y con coma decimal", () => {
    expect(parseOmniQuery("Lima @ 100")).toEqual({ kind: "place", text: "Lima", radiusKm: 100 });
    expect(parseOmniQuery("Lima@2,5km")).toEqual({ kind: "place", text: "Lima", radiusKm: 2.5 });
  });
  it("radio fuera de rango o no numerico se ignora", () => {
    expect(parseOmniQuery("Lima @0km")).toEqual({ kind: "place", text: "Lima" });
    expect(parseOmniQuery(`Lima @${RADIUS_LIMITS.max + 1}km`)).toEqual({ kind: "place", text: "Lima" });
    expect(parseOmniQuery("Lima @abc")).toEqual({ kind: "place", text: "Lima" });
    expect(parseOmniQuery("@2000km")).toEqual({ kind: "here", radiusKm: 2000 });
    expect(parseOmniQuery("@5000km")).toEqual({ kind: "empty" });
  });
  it("coordenadas con distintos separadores", () => {
    const expected = { kind: "coords", lat: 12.11, lon: -86.23 };
    expect(parseOmniQuery("12.11,-86.23")).toEqual(expected);
    expect(parseOmniQuery("12.11 -86.23")).toEqual(expected);
    expect(parseOmniQuery("12,11; -86,23")).toEqual(expected);
  });
  it("coordenadas con hemisferios", () => {
    expect(parseOmniQuery("12.11N 86.23W")).toEqual({ kind: "coords", lat: 12.11, lon: -86.23 });
    expect(parseOmniQuery("12.11S, 86.23E")).toEqual({ kind: "coords", lat: -12.11, lon: 86.23 });
  });
  it("coordenadas con radio", () => {
    expect(parseOmniQuery("12.11,-86.23 @30km")).toEqual({ kind: "coords", lat: 12.11, lon: -86.23, radiusKm: 30 });
  });
  it("fuera de rango es lugar", () => {
    expect(parseOmniQuery("91,10")).toEqual({ kind: "place", text: "91,10" });
    expect(parseOmniQuery("10 181")).toEqual({ kind: "place", text: "10 181" });
  });
  it("un solo numero no es coordenada", () => {
    expect(parseOmniQuery("12")).toEqual({ kind: "place", text: "12" });
  });
});
