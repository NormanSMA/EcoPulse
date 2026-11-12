import { describe, expect, it } from "vitest";
import { nearestKnownPlace, normalizeText, searchPlaces } from "./placeIndex";

describe("normalizeText", () => {
  it("minusculas, sin acentos y espacios colapsados", () => {
    expect(normalizeText("  Bogotá   DC ")).toBe("bogota dc");
  });
});

describe("searchPlaces", () => {
  it("menos de 2 caracteres devuelve vacio", () => {
    expect(searchPlaces("m")).toEqual([]);
    expect(searchPlaces(" a ")).toEqual([]);
  });
  it("forma GeocodeResult", () => {
    expect(searchPlaces("managua")).toEqual([{ name: "Managua", detail: "", lon: -86.2362, lat: 12.115, kind: "city" }]);
  });
  it("ignora acentos y mayusculas", () => {
    expect(searchPlaces("BOGOTÁ")[0]?.name).toBe("Bogota");
  });
  it("prefijo antes que subcadena", () => {
    const places = [
      { name: "San Salvador", lat: 1, lon: 1 },
      { name: "Salto", lat: 2, lon: 2 },
    ];
    expect(searchPlaces("sal", 5, places).map((p) => p.name)).toEqual(["Salto", "San Salvador"]);
  });
  it("respeta el limite", () => {
    expect(searchPlaces("an", 1)).toHaveLength(1);
    expect(searchPlaces("an", 5).length).toBeGreaterThan(1);
  });
  it("sin coincidencias", () => {
    expect(searchPlaces("zzzz")).toEqual([]);
  });
  it("incluye cabeceras de Nicaragua con detalle", () => {
    expect(searchPlaces("juigalpa")).toEqual([
      { name: "Juigalpa", detail: "Chontales, Nicaragua", lon: -85.368, lat: 12.106, kind: "city" },
    ]);
  });
});

describe("nearestKnownPlace", () => {
  it("encuentra la cabecera cercana con region y pais", () => {
    expect(nearestKnownPlace(-85.37, 12.11)).toMatchObject({ name: "Juigalpa", region: "Chontales", country: "Nicaragua" });
  });
  it("usa CITY_ANCHORS sin region ni pais", () => {
    expect(nearestKnownPlace(-84.09, 9.93)).toMatchObject({ name: "San Jose", region: null, country: null });
  });
  it("devuelve null fuera del radio", () => {
    expect(nearestKnownPlace(-86.25, 12.9, 5)).toBeNull();
    expect(nearestKnownPlace(0, 0)).toBeNull();
  });
});
