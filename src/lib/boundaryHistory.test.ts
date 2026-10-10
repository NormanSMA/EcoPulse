import { afterEach, describe, expect, it, vi } from "vitest";
import {
  distanceToBoundaryKm, fetchBoundaryHistory,
  findPlateBoundary, selectBoundaryEarthquakes, summarizeBoundaryHistory,
} from "./boundaryHistory";
import type { EarthquakeFeature } from "./types";

const boundary = { plates: "NZ-SA", lines: [[[0, -10], [0, 10]]], convergent: false };
const quake = (id: string, coordinates = [0.5, 0, 15], magnitude: number | null = 7, time = 1): EarthquakeFeature => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: coordinates as [number, number, number] },
  properties: { mag: magnitude, time, updated: time, place: id, url: "https://earthquake.usgs.gov/",
    alert: null, status: "reviewed", tsunami: 0, sig: 0 },
});

afterEach(() => vi.unstubAllGlobals());

describe("findPlateBoundary", () => {
  it("encuentra todos los segmentos NZ\\SA del catálogo real", () => {
    const found = findPlateBoundary("NZ-SA");
    expect(found?.plates).toBe("NZ-SA");
    expect(found?.lines.length).toBeGreaterThan(0);
    expect(found?.lines.flat().some(([longitude]) => longitude < -70)).toBe(true);
  });

  it("acepta el orden inverso, minúsculas y separadores PB2002", () => {
    for (const pair of ["SA-NZ", " nz-sa ", "NZ\\SA", "NZ/SA"]) {
      expect(findPlateBoundary(pair)).toEqual(findPlateBoundary("NZ-SA"));
    }
  });

  it.each([null, "", "NZ", "NZ-SA-CO", "NZ-NZ", "ZZ-SA", "NZ-PA<script>"])(
    "rechaza placas inválidas: %s", (pair) => expect(findPlateBoundary(pair)).toBeNull(),
  );
});

describe("distanceToBoundaryKm", () => {
  it("calcula la distancia al interior de un segmento, no solamente a sus extremos", () => {
    expect(distanceToBoundaryKm([0.5, 0], boundary.lines)).toBeCloseTo(55.6, 1);
    expect(distanceToBoundaryKm([0, 0], boundary.lines)).toBeCloseTo(0);
  });

  it("usa el extremo cuando la proyección queda fuera del segmento", () => {
    expect(distanceToBoundaryKm([0, 11], boundary.lines)).toBeCloseTo(111.2, 1);
    expect(distanceToBoundaryKm([0, -11], boundary.lines)).toBeCloseTo(111.2, 1);
  });

  it("evalúa todos los segmentos sin conectar líneas separadas", () => {
    const lines = [[[0, 0], [0, 1]], [[0, 10], [0, 11]]];
    expect(distanceToBoundaryKm([0, 5], lines)).toBeGreaterThan(400);
    expect(distanceToBoundaryKm([0.5, 10.5], lines)).toBeLessThan(56);
  });

  it("maneja el antimeridiano y las latitudes altas", () => {
    expect(distanceToBoundaryKm([180, 0.5], [[[179, 0], [-179, 0]]])).toBeCloseTo(55.6, 1);
    expect(distanceToBoundaryKm([0, 0], [[[179, 0], [-179, 0]]])).toBeGreaterThan(19_000);
    expect(distanceToBoundaryKm([-179, 80], [[[179, 79], [179, 81]]])).toBeLessThan(40);
  });

  it("maneja segmentos degenerados", () => {
    expect(distanceToBoundaryKm([0, 1], [[[0, 0], [0, 0]]])).toBeCloseTo(111.2, 1);
  });
});

describe("selectBoundaryEarthquakes", () => {
  it("filtra magnitud y proximidad antes de ordenar", () => {
    const features = [quake("near"), quake("far", [3, 0, 10], 9.5),
      quake("weak", undefined, 6.9), quake("unknown", undefined, null),
      quake("threshold", [0.89, 0, 700], 7), quake("outside", [0.91, 0, 10], 8)];
    const selected = selectBoundaryEarthquakes(features, boundary);
    expect(selected.map((feature) => feature.id)).toEqual(["near", "threshold"]);
    expect(selected[0].properties).toMatchObject({ distanceKm: 56, source: "USGS" });
    expect(features[0].properties.source).toBeUndefined();
  });

  it("ordena por magnitud y desempata por fecha", () => {
    const selected = selectBoundaryEarthquakes([
      quake("old", undefined, 8, 1), quake("new", undefined, 8, 2), quake("strong", undefined, 9),
    ], boundary);
    expect(selected.map((feature) => feature.id)).toEqual(["strong", "new", "old"]);
  });

  it("elimina duplicados y conserva el historial completo después del filtro geográfico", () => {
    const distant = Array.from({ length: 60 }, (_, index) => quake(`far-${index}`, [5, 0, 10], 9));
    const nearby = Array.from({ length: 60 }, (_, index) => quake(`near-${index}`, undefined, 7, index));
    const selected = selectBoundaryEarthquakes([...distant, ...nearby, nearby[59]], boundary);
    expect(selected).toHaveLength(60);
    expect(selected[0].id).toBe("near-59");
    expect(selected.at(-1)?.id).toBe("near-0");
  });
});

describe("summarizeBoundaryHistory", () => {
  it("cuenta todos los sismos por década UTC y conserva el sismo mayor", () => {
    const features = selectBoundaryEarthquakes([
      quake("older", undefined, 8, Date.parse("1960-05-22T19:11:20Z")),
      quake("old", undefined, 7, Date.parse("1969-12-31T23:59:59Z")),
      quake("new", undefined, 7, Date.parse("1970-01-01T00:00:00Z")),
    ], boundary);
    expect(summarizeBoundaryHistory(features)).toMatchObject({ total: 3, strongest: { id: "older" },
      byDecade: [{ decade: 1960, count: 2 }, { decade: 1970, count: 1 }] });
  });

  it("devuelve total cero y strongest null para un límite sin sismos", () => {
    expect(summarizeBoundaryHistory([])).toEqual({ features: [], total: 0, strongest: null, byDecade: [] });
  });
});

describe("fetchBoundaryHistory", () => {
  it("consulta todo el historial fuerte de USGS y conserva sus metadatos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ features: [quake("historic")] }) });
    vi.stubGlobal("fetch", fetchMock);
    const features = await fetchBoundaryHistory(boundary);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("starttime")).toBe("1900-01-01");
    expect(new URL(url).searchParams.get("minmagnitude")).toBe("7");
    expect(new URL(url).searchParams.get("eventtype")).toBe("earthquake");
    expect(new URL(url).searchParams.get("limit")).toBe("20000");
    expect(options.next.revalidate).toBe(86_400);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(features[0].properties).toMatchObject({ mag: 7, place: "historic", source: "USGS" });
  });

  it("acepta HTTP 204 sin intentar leer JSON", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, ok: true, json }));
    expect(await fetchBoundaryHistory(boundary)).toEqual([]);
    expect(json).not.toHaveBeenCalled();
  });

  it("propaga fallos HTTP y de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503, ok: false }));
    await expect(fetchBoundaryHistory(boundary)).rejects.toThrow("USGS HTTP 503");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
    await expect(fetchBoundaryHistory(boundary)).rejects.toThrow("Network failure");
  });

  it("propaga cancelación del solicitante", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options) => {
      options.signal.throwIfAborted();
    }));
    await expect(fetchBoundaryHistory(boundary, controller.signal)).rejects.toThrow();
  });

  it("rechaza catálogos truncados para evitar historiales incompletos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ features: Array(20_000).fill(quake("same")) }) }));
    await expect(fetchBoundaryHistory(boundary)).rejects.toThrow("truncado");
  });
});

describe("radio por tipo de límite", () => {
  it("en subducción acepta sismos a más de 100 km de la fosa", () => {
    const quake = { type: "Feature", id: "q", properties: { mag: 9.5, time: 0, place: "Valdivia" }, geometry: { type: "Point", coordinates: [1.3, 0, 30] } } as never;
    expect(selectBoundaryEarthquakes([quake], { ...boundary, convergent: false })).toHaveLength(0);
    expect(selectBoundaryEarthquakes([quake], { ...boundary, convergent: true })).toHaveLength(1);
  });
});
