import { describe, it, expect } from "vitest";
import { toEarthquakeRow, toAirQualityRow, toFireRow, toWeatherRow, toDisasterRow, toIssRow, toVolcanoRow, toAirQualityModelRow, dedupeByKey, isIngestAuthorized } from "./ingest";
import { EarthquakeFeature, AirQualityFeature, FireFeature, WeatherFeature, DisasterFeature, IssFeature, VolcanoFeature, AirQualityModelFeature } from "./types";

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

const sampleWeather: WeatherFeature = {
  type: "Feature",
  id: "Managua",
  properties: {
    city: "Managua",
    temperature: 27.4,
    humidity: 79,
    windSpeed: 17.8,
    windDirection: 146,
    weatherCode: 3,
    weatherDescription: "Nublado",
    updated: "2026-09-07T01:15:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-86.2362, 12.1150] },
};

describe("toWeatherRow", () => {
  it("mapea una feature de Open-Meteo a la forma de la tabla weather", () => {
    const row = toWeatherRow(sampleWeather);
    expect(row).toEqual({
      city: "Managua",
      temperature: 27.4,
      humidity: 79,
      wind_speed: 17.8,
      wind_direction: 146,
      weather_code: 3,
      location: "SRID=4326;POINT(-86.2362 12.115)",
      measured_at: "2026-09-07T01:15:00.000Z",
    });
  });
});

const sampleDisaster: DisasterFeature = {
  type: "Feature",
  id: "FL-1104081",
  properties: {
    eventId: "FL-1104081",
    eventType: "FL",
    eventTypeLabel: "Inundación",
    name: "Flood in China",
    country: "China",
    alertLevel: "Orange",
    fromDate: "2026-07-31T01:00:00.000Z",
    toDate: "2026-09-07T01:00:00.000Z",
    reportUrl: "https://www.gdacs.org/report.aspx?eventid=1104081",
  },
  geometry: { type: "Point", coordinates: [116.0, 28.0] },
};

describe("toDisasterRow", () => {
  it("mapea una feature de GDACS a la forma de la tabla disasters", () => {
    const row = toDisasterRow(sampleDisaster);
    expect(row).toEqual({
      event_id: "FL-1104081",
      event_type: "FL",
      name: "Flood in China",
      country: "China",
      alert_level: "Orange",
      from_date: "2026-07-31T01:00:00.000Z",
      to_date: "2026-09-07T01:00:00.000Z",
      report_url: "https://www.gdacs.org/report.aspx?eventid=1104081",
      location: "SRID=4326;POINT(116 28)",
    });
  });
});

const sampleIss: IssFeature = {
  type: "Feature",
  id: "iss",
  properties: {
    altitudeKm: 420.79,
    velocityKmS: 7.66,
    timestamp: "2026-09-04T12:00:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-71.04, -6.73] },
};

describe("toIssRow", () => {
  it("mapea la posicion de la ISS a la forma de la tabla iss_position", () => {
    const row = toIssRow(sampleIss);
    expect(row).toEqual({
      id: "current",
      altitude_km: 420.79,
      velocity_kms: 7.66,
      observed_at: "2026-09-04T12:00:00.000Z",
      location: "SRID=4326;POINT(-71.04 -6.73)",
    });
  });
});

const sampleVolcano: VolcanoFeature = {
  type: "Feature",
  id: 210020,
  properties: {
    volcanoNumber: 210020,
    name: "Chaine des Puys",
    country: "France",
    volcanoType: "Lava dome(s)",
    lastEruptionYear: -4040,
    elevationM: 1464,
  },
  geometry: { type: "Point", coordinates: [2.981, 45.786] },
};

describe("toVolcanoRow", () => {
  it("mapea una feature de GVP a la forma de la tabla volcanoes", () => {
    const row = toVolcanoRow(sampleVolcano);
    expect(row).toEqual({
      volcano_number: 210020,
      name: "Chaine des Puys",
      country: "France",
      volcano_type: "Lava dome(s)",
      last_eruption_year: -4040,
      elevation_m: 1464,
      location: "SRID=4326;POINT(2.981 45.786)",
    });
  });
});

const sampleAirQualityModel: AirQualityModelFeature = {
  type: "Feature",
  id: "Managua",
  properties: {
    city: "Managua",
    pm25: 5.9,
    category: "good",
    updated: "2026-09-07T02:00:00.000Z",
  },
  geometry: { type: "Point", coordinates: [-86.2362, 12.1150] },
};

describe("toAirQualityModelRow", () => {
  it("mapea una feature modelada de Open-Meteo a la forma de la tabla air_quality_model", () => {
    const row = toAirQualityModelRow(sampleAirQualityModel);
    expect(row).toEqual({
      city: "Managua",
      pm25_value: 5.9,
      aqi_category: "good",
      location: "SRID=4326;POINT(-86.2362 12.115)",
      measured_at: "2026-09-07T02:00:00.000Z",
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
    expect(isIngestAuthorized(request, undefined, false)).toBe(true);
  });

  it("rechaza en producción si no hay secreto configurado", () => {
    const request = new Request("http://localhost/api/ingest");
    expect(isIngestAuthorized(request, undefined, true)).toBe(false);
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
