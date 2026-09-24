import { describe, it, expect, vi, afterEach } from "vitest";
import { toVolcanoFeature, fetchVolcanoes, fromNcei } from "./gvp";

const realVolcanoRaw = {
  geometry: { type: "Point", coordinates: [2.981, 45.786] as [number, number] },
  properties: {
    Volcano_Number: 210020,
    Volcano_Name: "Chaine des Puys",
    Country: "France",
    Primary_Volcano_Type: "Lava dome(s)",
    Last_Eruption_Year: -4040,
    Elevation: 1464,
  },
};

const noEruptionRaw = {
  geometry: { type: "Point", coordinates: [12.7251, 41.7569] as [number, number] },
  properties: {
    Volcano_Number: 211004,
    Volcano_Name: "Colli Albani",
    Country: "Italy",
    Primary_Volcano_Type: "Caldera",
    Last_Eruption_Year: null,
    Elevation: 949,
  },
};

describe("toVolcanoFeature", () => {
  it("mapea un volcan real del catalogo GVP a una feature GeoJSON", () => {
    const feature = toVolcanoFeature(realVolcanoRaw);
    expect(feature).not.toBeNull();
    expect(feature?.id).toBe(210020);
    expect(feature?.properties.name).toBe("Chaine des Puys");
    expect(feature?.properties.lastEruptionYear).toBe(-4040);
    expect(feature?.geometry.coordinates).toEqual([2.981, 45.786]);
  });

  it("permite lastEruptionYear null cuando no hay fecha documentada", () => {
    const feature = toVolcanoFeature(noEruptionRaw);
    expect(feature?.properties.lastEruptionYear).toBeNull();
  });

  it("normaliza a null si la API real omite el campo en vez de mandar null explicito", () => {
    const rawWithMissingField = {
      ...noEruptionRaw,
      properties: { ...noEruptionRaw.properties, Last_Eruption_Year: undefined as unknown as null },
    };
    const feature = toVolcanoFeature(rawWithMissingField);
    expect(feature?.properties.lastEruptionYear).toBeNull();
  });

  it("descarta features sin geometria de tipo Point", () => {
    expect(toVolcanoFeature({ ...realVolcanoRaw, geometry: null })).toBeNull();
  });
});

describe("fetchVolcanoes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea todas las features validas de una respuesta real de GVP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [realVolcanoRaw, noEruptionRaw] }),
      })
    );

    const result = await fetchVolcanoes();
    expect(result.features).toHaveLength(2);
  });

  it("devuelve vacio si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await fetchVolcanoes();
    expect(result.features).toEqual([]);
  });
});

describe("respaldo NOAA NCEI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mapea un volcán de NCEI conservando el número GVP", () => {
    const f = fromNcei({ id: 10001, newNum: 210010, name: "West Eifel Volcanic Field", country: "Germany", latitude: 50.17, longitude: 6.85, elevation: 600, morphology: "Maar", timeErupt: "D7" });
    expect(f?.id).toBe(210010);
    expect(f?.properties.lastEruptionPeriod).toBe("D7");
    expect(f?.geometry.coordinates).toEqual([6.85, 50.17]);
  });

  it("usa NCEI cuando el WFS del Smithsonian falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("volcano.si.edu")) return Promise.reject(new TypeError("fetch failed"));
        return Promise.resolve({
          ok: true,
          json: async () => ({ totalPages: 1, items: [{ id: 1, newNum: 211060, name: "Etna", country: "Italy", latitude: 37.75, longitude: 14.99, elevation: 3357, morphology: "Stratovolcano", timeErupt: "D1" }] }),
        });
      })
    );
    const result = await fetchVolcanoes();
    expect(result.features.map((f) => f.properties.name)).toEqual(["Etna"]);
  });
});
