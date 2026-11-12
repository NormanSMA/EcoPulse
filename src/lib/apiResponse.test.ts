import { describe, expect, it } from "vitest";
import { badRequest, cachedJson, parseLatLon } from "./apiResponse";

const url = (query: string) => new URL(`https://ecopulse.test/api/point${query}`);

describe("parseLatLon", () => {
  it("lee un punto valido", () => {
    expect(parseLatLon(url("?lat=12.115&lon=-86.236"))).toEqual({ lat: 12.115, lon: -86.236 });
  });

  it("acepta el punto (0,0) cuando se pide de forma explicita", () => {
    expect(parseLatLon(url("?lat=0&lon=0"))).toEqual({ lat: 0, lon: 0 });
  });

  it("rechaza la query sin lat o sin lon", () => {
    expect(parseLatLon(url(""))).toBeNull();
    expect(parseLatLon(url("?lat=12"))).toBeNull();
    expect(parseLatLon(url("?lon=-86"))).toBeNull();
  });

  it("rechaza valores vacios o no numericos", () => {
    expect(parseLatLon(url("?lat=&lon="))).toBeNull();
    expect(parseLatLon(url("?lat=%20&lon=%20"))).toBeNull();
    expect(parseLatLon(url("?lat=abc&lon=-86"))).toBeNull();
  });

  it("rechaza valores fuera de rango", () => {
    expect(parseLatLon(url("?lat=91&lon=0"))).toBeNull();
    expect(parseLatLon(url("?lat=0&lon=181"))).toBeNull();
  });
});

describe("cachedJson", () => {
  it("cachea en el CDN solo cuando hay datos", () => {
    expect(cachedJson({}, 900, true).headers.get("Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=5400");
    expect(cachedJson({}, 900, false).headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("badRequest", () => {
  it("responde 400 sin cache", async () => {
    const response = badRequest("lat/lon invalidos");
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ success: false, error: "lat/lon invalidos" });
  });
});
