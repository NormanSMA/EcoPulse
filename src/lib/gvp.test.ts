import { describe, it, expect, vi, afterEach } from "vitest";
import { toVolcanoFeature, fetchVolcanoes } from "./gvp";

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
