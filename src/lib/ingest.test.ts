import { describe, it, expect } from "vitest";
import { toEarthquakeRow, toAirQualityRow, toFireRow, dedupeByKey, isIngestAuthorized } from "./ingest";
import { EarthquakeFeature, AirQualityFeature, FireFeature } from "./types";

const sampleEarthquake: EarthquakeFeature = {
  type: "Feature",
  id: "us7000abcd",
  properties: {
    mag: 5.4,
    place: "10km N of Managua",
    time: 1700000000000,
    updated: 1700000000000,
    url: "https://example.com",
    alert: "orange",
    status: "reviewed",
    tsunami: 0,
    sig: 400,
  },
  geometry: { type: "Point", coordinates: [-86.2, 12.1, 10] },
};

const sampleAirQuality: AirQualityFeature = {
  type: "Feature",
  id: 999,
  properties: {
    station: "Managua Centro",
    pm25: 14.5,
    category: "good",
    updated: "2026-01-01T00:00:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-86.2, 12.1] },
};

describe("toEarthquakeRow", () => {
  it("mapea una feature de USGS a la forma de la tabla earthquakes", () => {
    const row = toEarthquakeRow(sampleEarthquake);
    expect(row).toEqual({
      usgs_id: "us7000abcd",
      magnitude: 5.4,
      place: "10km N of Managua",
      depth: 10,
      alert: "orange",
      event_time: new Date(1700000000000).toISOString(),
      location: "SRID=4326;POINT(-86.2 12.1)",
    });
  });

  it("usa depth null cuando la geometria no trae profundidad", () => {
    const feature: EarthquakeFeature = {
      ...sampleEarthquake,
      geometry: { type: "Point", coordinates: [-86.2, 12.1, undefined as unknown as number] },
    };
    const row = toEarthquakeRow(feature);
    expect(row.depth).toBeNull();
  });
});

describe("toAirQualityRow", () => {
  it("mapea una feature de OpenAQ a la forma de la tabla air_quality", () => {
    const row = toAirQualityRow(sampleAirQuality);
    expect(row).toEqual({
      station_id: "999",
      station_name: "Managua Centro",
      pm25_value: 14.5,
      aqi_category: "good",
      location: "SRID=4326;POINT(-86.2 12.1)",
      measured_at: "2026-01-01T00:00:00.000Z",
    });
  });
});

const sampleFire: FireFeature = {
  type: "Feature",
  id: "12.432_-85.988_2026-09-06_1345_N20",
  properties: {
    fireKey: "12.432_-85.988_2026-09-06_1345_N20",
    brightness: 345.8,
    frp: 42.7,
    confidence: "high",
    satellite: "N20",
    acquiredAt: "2026-09-06T13:45:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-85.988, 12.432] },
};

describe("toFireRow", () => {
  it("mapea una feature de FIRMS a la forma de la tabla fires", () => {
    const row = toFireRow(sampleFire);
    expect(row).toEqual({
      fire_key: "12.432_-85.988_2026-09-06_1345_N20",
      brightness: 345.8,
      frp: 42.7,
      confidence: "high",
      satellite: "N20",
      acquired_at: "2026-09-06T13:45:00.000Z",
      location: "SRID=4326;POINT(-85.988 12.432)",
    });
  });
});

describe("dedupeByKey", () => {
  it("elimina filas con la misma clave, quedandose con la ultima ocurrencia", () => {
    const rows = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
      { id: "a", value: 3 },
    ];
    expect(dedupeByKey(rows, "id")).toEqual([
      { id: "a", value: 3 },
      { id: "b", value: 2 },
    ]);
  });

  it("no cambia nada si no hay claves repetidas", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(dedupeByKey(rows, "id")).toEqual(rows);
  });
});

describe("isIngestAuthorized", () => {
  it("permite la llamada si no hay secreto configurado", () => {
    const request = new Request("http://localhost/api/ingest");
    expect(isIngestAuthorized(request, undefined)).toBe(true);
  });

  it("rechaza si el header Authorization no coincide con el secreto", () => {
    const request = new Request("http://localhost/api/ingest", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(isIngestAuthorized(request, "correct-secret")).toBe(false);
  });

  it("permite si el header Authorization coincide con el secreto", () => {
    const request = new Request("http://localhost/api/ingest", {
      headers: { authorization: "Bearer correct-secret" },
    });
    expect(isIngestAuthorized(request, "correct-secret")).toBe(true);
  });
});
