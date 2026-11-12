import { describe, expect, it } from "vitest";
import type { WeatherFrame } from "../../lib/forecast/types";
import { weatherFrameToGeoJSON } from "./weatherLayers";

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
