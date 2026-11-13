import { describe, expect, it, vi } from "vitest";
import type { GeoJSONSourceSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { WeatherFrame } from "../../lib/forecast/types";
import { buildFrameFields } from "../../lib/forecast/field";
import { addWeatherLayers, setWeatherFrame, weatherFrameToGeoJSON } from "./weatherLayers";

const frame: WeatherFrame = {
  time: 1_700_000_000_000,
  features: [
    {
      lon: -86.25,
      lat: 12.15,
      windSpeed: 20,
      windDirection: 0,
      windGusts: 30,
      u: 0,
      v: -20,
      cloudCover: 80,
      precipitation: 1.2,
      precipitationProbability: null,
      temperature: 28,
    },
    {
      lon: -86.5,
      lat: 12.5,
      windSpeed: 15,
      windDirection: 270,
      windGusts: 25,
      u: 15,
      v: 0,
      cloudCover: 40,
      precipitation: 0,
      precipitationProbability: 65,
      temperature: 26,
    },
  ],
};

describe("weatherFrameToGeoJSON", () => {
  it("devuelve una colección vacía sin cuadro", () => {
    expect(weatherFrameToGeoJSON(null)).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("conserva coordenadas y propiedades con rotación hacia el destino del viento", () => {
    const result = weatherFrameToGeoJSON(frame);

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-86.25, 12.15] },
      properties: {
        windSpeed: 20,
        windDirection: 0,
        windGusts: 30,
        u: 0,
        v: -20,
        cloudCover: 80,
        precipitation: 1.2,
        precipitationProbability: 0,
        temperature: 28,
        arrowRotation: 180,
      },
    });
    expect(result.features[1].geometry).toEqual({ type: "Point", coordinates: [-86.5, 12.5] });
    expect(result.features[1].properties).toMatchObject({ arrowRotation: 90, precipitationProbability: 65 });
  });

  it("convierte probabilidad nula en cero sin modificar el cuadro", () => {
    const result = weatherFrameToGeoJSON(frame);

    expect(result.features[0].properties?.precipitationProbability).toBe(0);
    expect(frame.features[0].precipitationProbability).toBeNull();
  });
});

function mockMap() {
  const sourceSetters = new Map<string, ReturnType<typeof vi.fn>>();
  const addSource = vi.fn<(id: string, source: GeoJSONSourceSpecification) => void>((id) => {
    sourceSetters.set(id, vi.fn());
  });
  const addLayer = vi.fn<(layer: LayerSpecification, beforeId?: string) => void>();
  const setPaintProperty = vi.fn();
  const map = {
    hasImage: () => true,
    getSource: (id: string) => sourceSetters.has(id) ? { setData: sourceSetters.get(id) } : undefined,
    getLayer: (id: string) => addLayer.mock.calls.find(([layer]) => layer.id === id)?.[0],
    addSource,
    addLayer,
    setPaintProperty,
  } as unknown as MapLibreMap;
  return { map, addSource, addLayer, sourceSetters, setPaintProperty };
}

const visible = { wind: true, clouds: true, rain: true };

describe("addWeatherLayers", () => {
  it("densifica campos y conserva la rejilla para flechas, puntos y etiquetas", () => {
    const { map, addSource, addLayer } = mockMap();
    addWeatherLayers(map, frame, visible, "events");
    expect(addSource).toHaveBeenCalledTimes(3);
    expect(addSource.mock.calls[0]).toEqual(["weather-grid", {
      type: "geojson", data: weatherFrameToGeoJSON(frame),
    }]);
    for (const [id, source] of addSource.mock.calls.slice(1)) {
      expect(["weather-clouds-field", "weather-rain-field"]).toContain(id);
      const data = source.data as GeoJSON.FeatureCollection<GeoJSON.Point>;
      expect(data.features.length).toBeGreaterThan(frame.features.length);
      for (const feature of data.features) {
        expect(feature.properties?.value).toBeGreaterThanOrEqual(id === "weather-clouds-field" ? 5 : 0.05);
      }
    }
    const fields = buildFrameFields(frame);
    const radius = (fields!.cellDeg * 512 / 360) * 1.6;
    for (const id of ["weather-clouds", "weather-rain"]) {
      expect(map.getLayer(id)).toMatchObject({
        type: "heatmap", source: `${id}-field`,
        layout: { visibility: "visible" },
        paint: { "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, radius, 22, radius * 2 ** 22] },
      });
    }
    expect(map.getLayer("weather-clouds")).toMatchObject({ paint: { "heatmap-weight": ["/", ["get", "value"], 100] } });
    expect(map.getLayer("weather-rain")).toMatchObject({ paint: { "heatmap-weight": ["min", 1, ["/", ["get", "value"], 10]] } });
    for (const [id, type] of [["weather-wind", "symbol"], ["weather-grid-points", "circle"], ["weather-rain-label", "symbol"]]) {
      expect(map.getLayer(id)).toMatchObject({ type, source: "weather-grid" });
    }
    expect(map.getLayer("weather-rain-label")).toMatchObject({ minzoom: 7, filter: [">=", ["get", "precipitation"], 0.5] });
    expect(addLayer.mock.calls.every(([, beforeId]) => beforeId === "events")).toBe(true);
    addWeatherLayers(map, frame, visible);
    expect(addSource).toHaveBeenCalledTimes(3);
    expect(addLayer).toHaveBeenCalledTimes(5);
  });

  it("crea fuentes vacías y respeta capas desactivadas", () => {
    const { map, addSource, addLayer } = mockMap();
    addWeatherLayers(map, null, { wind: false, clouds: false, rain: false });
    for (const [, source] of addSource.mock.calls) {
      expect(source.data).toEqual({ type: "FeatureCollection", features: [] });
    }
    expect(addLayer.mock.calls.every(([layer]) => layer.layout?.visibility === "none")).toBe(true);
  });

  it("omite valores inferiores a los umbrales", () => {
    const { map, addSource } = mockMap();
    const dryFrame = { ...frame, features: frame.features.map((point) => ({ ...point, cloudCover: 4, precipitation: 0.04 })) };
    addWeatherLayers(map, dryFrame, visible);
    for (const [, source] of addSource.mock.calls.slice(1)) {
      expect(source.data).toEqual({ type: "FeatureCollection", features: [] });
    }
  });
});

describe("setWeatherFrame", () => {
  it("actualiza tres fuentes y recalcula el radio al cambiar la caja", () => {
    const { map, sourceSetters, setPaintProperty } = mockMap();
    addWeatherLayers(map, null, visible);
    setWeatherFrame(map, frame);
    expect(sourceSetters.get("weather-grid")).toHaveBeenCalledWith(weatherFrameToGeoJSON(frame));
    for (const id of ["weather-clouds-field", "weather-rain-field"]) {
      const data = sourceSetters.get(id)!.mock.calls[0][0] as GeoJSON.FeatureCollection;
      expect(data.features.length).toBeGreaterThan(frame.features.length);
    }
    const fields = buildFrameFields(frame);
    const radius = (fields!.cellDeg * 512 / 360) * 1.6;
    for (const id of ["weather-clouds", "weather-rain"]) {
      expect(setPaintProperty).toHaveBeenCalledWith(id, "heatmap-radius", ["interpolate", ["exponential", 2], ["zoom"], 0, radius, 22, radius * 2 ** 22]);
    }
    setWeatherFrame(map, null);
    for (const setter of sourceSetters.values()) {
      expect(setter).toHaveBeenLastCalledWith({ type: "FeatureCollection", features: [] });
    }
  });

  it("tolera fuentes todavía inexistentes", () => {
    const { map } = mockMap();
    expect(() => setWeatherFrame(map, frame)).not.toThrow();
  });
});
