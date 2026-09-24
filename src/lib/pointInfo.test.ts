import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode, isLatin } from "./pointInfo";

describe("isLatin", () => {
  it("distingue nombres latinos de otros alfabetos", () => {
    expect(isLatin("Managua, Nicaragua")).toBe(true);
    expect(isLatin("Perú")).toBe(true);
    expect(isLatin("東京都 日本")).toBe(false);
    expect(isLatin("Москва")).toBe(false);
    expect(isLatin("")).toBe(true);
  });
});

describe("geocode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pide los nombres en el idioma de la interfaz y arma el detalle sin repetir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { name: "Tokio", latitude: 35.69, longitude: 139.69, feature_code: "PPLC", country: "Japón", admin1: "Tokio" },
            { name: "Tokio", latitude: 35.69, longitude: 139.69, feature_code: "PPLC", country: "Japón", admin1: "Tokio" },
            { name: "Tokio", latitude: 47.92, longitude: -98.82, feature_code: "PPL", country: "Estados Unidos", admin1: "Dakota del Norte" },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const results = await geocode("Tokio", "es");
    expect(String(fetchMock.mock.calls[0][0])).toContain("language=es");
    expect(results).toEqual([
      { name: "Tokio", detail: "Japón", lon: 139.69, lat: 35.69, kind: "PPLC" },
      { name: "Tokio", detail: "Dakota del Norte, Estados Unidos", lon: -98.82, lat: 47.92, kind: "PPL" },
    ]);
  });

  it("sin coincidencias devuelve una lista vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ generationtime_ms: 0.1 }))));
    expect(await geocode("zzzz", "en")).toEqual([]);
  });
});
