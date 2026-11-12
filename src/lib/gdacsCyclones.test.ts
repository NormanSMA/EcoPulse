import { normalizeStormCategory, stormColor } from "@/design-system/tokens";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActiveCyclones, loadCyclones, parseTrackLabel, toCycloneFeatures } from "./gdacsCyclones";
import fixture from "./__fixtures__/gdacs-tc-geometry.json";

// Fixture recortado de una respuesta real de GDACS (ciclón ONE-26, aviso
// del 23/09/2026 18:00 UTC): 6 segmentos, 7 puntos (2 de pronóstico) y cono.
const ADVISORY = Date.UTC(2026, 8, 23, 18, 0);

describe("parseTrackLabel", () => {
  it("interpreta dd/mm HH:MM con el año de referencia", () => {
    expect(parseTrackLabel("24/09 06:00 UTC", new Date(ADVISORY))).toBe(Date.UTC(2026, 8, 24, 6, 0));
  });
  it("cruza de año para pronósticos de enero emitidos en diciembre", () => {
    expect(parseTrackLabel("01/01 00:00 UTC", new Date(Date.UTC(2026, 11, 31)))).toBe(Date.UTC(2027, 0, 1));
  });
});

describe("toCycloneFeatures", () => {
  const features = toCycloneFeatures(fixture.features as never, {
    eventId: "TC-1",
    name: "ONE-26",
    alertLevel: "Orange",
    advisoryTime: ADVISORY,
  });

  it("separa trayectoria observada y pronóstico", () => {
    const tracks = features.filter((f) => f.properties.kind === "track");
    expect(tracks).toHaveLength(6);
    expect(tracks.filter((f) => f.properties.forecast)).toHaveLength(2);
  });

  it("incluye el cono y la posición del último aviso", () => {
    expect(features.some((f) => f.properties.kind === "cone")).toBe(true);
    const pos = features.find((f) => f.properties.kind === "position");
    expect(pos?.geometry.type).toBe("Point");
  });
});

describe("normalizeStormCategory", () => {
  it("reduce las etiquetas de GDACS a TD / TS / HU", () => {
    expect(normalizeStormCategory("TD")).toBe("TD");
    expect(normalizeStormCategory("TS")).toBe("TS");
    expect(normalizeStormCategory("HU")).toBe("HU");
    expect(normalizeStormCategory("TY")).toBe("HU");
    expect(normalizeStormCategory("Cat. 4")).toBe("HU");
    expect(normalizeStormCategory(undefined)).toBe("TS");
  });

  it("el color de un huracán sin número no cae en el de tormenta", () => {
    expect(stormColor("HU")).not.toBe(stormColor("TS"));
  });
});

describe("loadCyclones", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["http", "red"])("tolera el fallo de geometría individual: %s", async (failure) => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [{ properties: {
        eventid: 1,
        episodeid: 1,
        name: "ONE-26",
        alertlevel: "Orange",
        iscurrent: true,
        todate: "2026-09-23T18:00:00Z",
        url: { geometry: "https://www.gdacs.org/geometry/1" },
      } }] }),
    });
    if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    else fetchMock.mockRejectedValueOnce(new TypeError("sin red"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadCyclones()).resolves.toEqual({ type: "FeatureCollection", features: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lanza con HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadCyclones()).rejects.toThrow("GDACS TC HTTP 500");
  });

  it("lanza cuando fetch rechaza", async () => {
    const error = new TypeError("sin red");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadCyclones()).rejects.toBe(error);
  });

  it("conserva la tolerancia del envoltorio ante fallos de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("sin red")));
    await expect(fetchActiveCyclones()).resolves.toEqual({ type: "FeatureCollection", features: [] });
  });

  it("relanza AbortError en el cargador y el envoltorio", async () => {
    const error = new DOMException("cancelado", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(loadCyclones()).rejects.toBe(error);
    await expect(fetchActiveCyclones()).rejects.toBe(error);
  });
});
