import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLiveEarthquakes } from "./usgs";

const sampleFeed = {
  type: "FeatureCollection" as const,
  metadata: { generated: 1, url: "u", title: "t", status: 200, api: "1", count: 1 },
  features: [
    {
      type: "Feature" as const,
      id: "eq1",
      properties: {
        mag: 5.4,
        place: "10km N of Managua",
        time: 1700000000000,
        updated: 1700000000000,
        url: "https://example.com",
        alert: null,
        status: "reviewed",
        tsunami: 0,
        sig: 400,
      },
      geometry: { type: "Point" as const, coordinates: [-86.2, 12.1, 10] as [number, number, number] },
    },
  ],
};

describe("fetchLiveEarthquakes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve el GeoJSON del feed cuando la respuesta es exitosa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleFeed,
      })
    );

    const result = await fetchLiveEarthquakes();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.mag).toBe(5.4);
  });

  it("devuelve una FeatureCollection vacía de fallback si la respuesta no es ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => ({}),
      })
    );

    const result = await fetchLiveEarthquakes();
    expect(result.features).toEqual([]);
    expect(result.metadata.status).toBe(500);
  });

  it("re-lanza el error cuando el fetch fue abortado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"))
    );

    await expect(fetchLiveEarthquakes()).rejects.toThrow("Aborted");
  });
});
