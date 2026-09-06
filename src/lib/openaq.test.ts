import { describe, it, expect } from "vitest";
import { getAQICategory, mockAirQualityGeoJSON } from "./openaq";

describe("getAQICategory", () => {
  it("clasifica como 'good' en el límite inferior y en 12.0", () => {
    expect(getAQICategory(0)).toBe("good");
    expect(getAQICategory(12.0)).toBe("good");
  });

  it("clasifica como 'moderate' justo sobre 12.0 y en el límite 35.4", () => {
    expect(getAQICategory(12.1)).toBe("moderate");
    expect(getAQICategory(35.4)).toBe("moderate");
  });

  it("clasifica como 'unhealthy' justo sobre 35.4 y en el límite 55.4", () => {
    expect(getAQICategory(35.5)).toBe("unhealthy");
    expect(getAQICategory(55.4)).toBe("unhealthy");
  });

  it("clasifica como 'hazardous' por encima de 55.4", () => {
    expect(getAQICategory(55.5)).toBe("hazardous");
    expect(getAQICategory(200)).toBe("hazardous");
  });
});

describe("mockAirQualityGeoJSON", () => {
  it("devuelve una FeatureCollection con la forma esperada", () => {
    const result = mockAirQualityGeoJSON();
    expect(result.type).toBe("FeatureCollection");
    expect(result.features.length).toBeGreaterThan(0);
  });

  it("cada feature tiene coordenadas [lng, lat] y categoría consistente con su pm25", () => {
    const result = mockAirQualityGeoJSON();
    for (const feature of result.features) {
      expect(feature.type).toBe("Feature");
      expect(feature.geometry.type).toBe("Point");
      expect(feature.geometry.coordinates).toHaveLength(2);
      expect(feature.properties.category).toBe(getAQICategory(feature.properties.pm25));
    }
  });
});
