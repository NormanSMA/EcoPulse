import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const request = (query: string) => new Request(`http://localhost/api/boundary-history${query}`);

describe("GET /api/boundary-history", () => {
  it.each(["", "?plates=", "?plates=ZZ-SA", "?plates=NZ-SA&plates=SA-NZ"])(
    "devuelve HTTP 400 sin consultar USGS: %s", async (query) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("devuelve GeoJSON histórico del límite real NZ-SA con caché diaria", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200,
      json: async () => ({ features: [{ type: "Feature", id: "chile-2015",
        properties: { mag: 8.3, time: Date.parse("2015-09-16T22:54:32Z"), place: "Chile", url: "https://earthquake.usgs.gov/" },
        geometry: { type: "Point", coordinates: [-71.6744, -31.5729, 22.4] } }] }) }));
    const response = await GET(request("?plates=NZ-SA"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const collection = await response.json();
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.metadata).toMatchObject({ plates: "NZ-SA", source: "USGS", count: 1,
      starttime: "1900-01-01", minMagnitude: 7, radiusKm: 100 });
    expect(collection.features[0].id).toBe("chile-2015");
    expect(collection.total).toBe(1);
    expect(collection.strongest.id).toBe("chile-2015");
    expect(collection.byDecade).toEqual([{ decade: 2010, count: 1 }]);
  });

  it("acepta placas en orden inverso y devuelve una colección vacía sin caché", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204, ok: true }));
    const response = await GET(request("?plates=SA-NZ"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ metadata: { plates: "NZ-SA", count: 0 },
      features: [], total: 0, strongest: null, byDecade: [] });
  });

  it("devuelve HTTP 500 sin caché cuando USGS falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("USGS unavailable")));
    const response = await GET(request("?plates=NZ-SA"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ success: false });
  });
});
