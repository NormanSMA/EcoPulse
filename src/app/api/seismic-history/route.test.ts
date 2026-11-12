import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const request = (query: string) => new Request(`http://localhost/api/seismic-history${query}`);
const usgsEvent = (id: string, mag: number) => ({ type: "Feature", id,
  properties: { mag, time: Date.parse("2015-09-16T22:54:32Z"), place: "Chile", url: "https://earthquake.usgs.gov/" },
  geometry: { type: "Point", coordinates: [-71.6744, -31.5729, 22.4] } });

describe("GET /api/seismic-history", () => {
  it.each([
    "", "?plates=", "?plates=ZZ-SA", "?plates=NZ-SA&plates=SA-NZ",
    "?mode=point", "?mode=point&lat=1", "?lat=1&lon=2&radiusKm=501",
  ])("devuelve HTTP 400 sin consultar fuentes: %s", async (query) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve GeoJSON histórico del límite real NZ-SA con caché diaria", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ features: [usgsEvent("chile-2015", 8.3)] }) }));
    const response = await GET(request("?mode=boundary&plates=NZ-SA"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const collection = await response.json();
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.metadata).toMatchObject({ mode: "boundary", plates: "NZ-SA", sources: ["USGS"], count: 1,
      starttime: "1900-01-01", minMagnitude: 7, radiusKm: 250 });
    expect(collection.features[0].id).toBe("chile-2015");
    expect(collection.summary.total).toBe(1);
    expect(collection.summary.strongest.id).toBe("chile-2015");
    expect(collection.summary.byDecade).toEqual([{ decade: 2010, count: 1 }]);
  });

  it("acepta placas en orden inverso y devuelve una colección vacía sin caché", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, ok: true }));
    const response = await GET(request("?plates=SA-NZ"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ metadata: { plates: "NZ-SA", count: 0 },
      features: [], summary: { total: 0, strongest: null, byDecade: [] } });
  });

  it("devuelve HTTP 500 sin caché cuando USGS falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("USGS unavailable")));
    const response = await GET(request("?plates=NZ-SA"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("point devuelve 200 con caché de 900 s", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).includes("earthquake.usgs.gov")
      ? { ok: true, status: 200, json: async () => ({ features: [usgsEvent("a", 4)] }) }
      : { ok: true, status: 204 }));
    const response = await GET(request("?mode=point&lat=-31.5&lon=-71.6"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=900");
    expect(await response.json()).toMatchObject({ metadata: { mode: "point", count: 1, radiusKm: 150 } });
  });

  it("point con lista vacía responde no-store", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, ok: true }));
    const response = await GET(request("?mode=point&lat=-31.5&lon=-71.6"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
