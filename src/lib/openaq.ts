import { AQICategory, AirQualityGeoJSON, AirQualityFeature } from "./types";
import { CityAnchor, CITY_ANCHORS } from "./cityAnchors";

const OPENAQ_BASE = "https://api.openaq.org/v3";
const PM25_PARAMETER_ID = 2;
const SEARCH_RADIUS_METERS = 25000;

interface OpenAQLocationsResponse {
  results: {
    id: number;
    name: string;
    coordinates: { latitude: number; longitude: number };
    sensors: { id: number; parameter: { name: string } }[];
  }[];
}

interface OpenAQSensorResponse {
  results: {
    latest: { value: number; datetime: { utc: string } } | null;
  }[];
}

interface NearestStation {
  locationName: string;
  sensorId: number;
  latitude: number;
  longitude: number;
}

export function getAQICategory(pm25: number): AQICategory {
  if (pm25 <= 12.0) return "good";
  if (pm25 <= 35.4) return "moderate";
  if (pm25 <= 55.4) return "unhealthy";
  return "hazardous";
}

async function fetchNearestPm25Station(
  anchor: CityAnchor,
  apiKey: string,
  signal?: AbortSignal
): Promise<NearestStation | null> {
  const url = `${OPENAQ_BASE}/locations?coordinates=${anchor.lat},${anchor.lon}&radius=${SEARCH_RADIUS_METERS}&parameters_id=${PM25_PARAMETER_ID}&limit=1`;
  const res = await fetch(url, { headers: { "X-API-Key": apiKey }, signal });
  if (!res.ok) return null;

  const data: OpenAQLocationsResponse = await res.json();
  const location = data.results[0];
  if (!location) return null;

  const sensor = location.sensors.find((s) => s.parameter.name === "pm25");
  if (!sensor) return null;

  return {
    locationName: location.name,
    sensorId: sensor.id,
    latitude: location.coordinates.latitude,
    longitude: location.coordinates.longitude,
  };
}

async function fetchSensorLatestValue(
  sensorId: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<number | null> {
  const res = await fetch(`${OPENAQ_BASE}/sensors/${sensorId}`, {
    headers: { "X-API-Key": apiKey },
    signal,
  });
  if (!res.ok) return null;

  const data: OpenAQSensorResponse = await res.json();
  const value = data.results[0]?.latest?.value;
  return value === undefined ? null : value;
}

export async function fetchLiveAirQuality(signal?: AbortSignal): Promise<AirQualityGeoJSON> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    console.error("OPENAQ_API_KEY no configurada, usando datos de respaldo");
    return mockAirQualityGeoJSON();
  }

  const features: AirQualityFeature[] = [];

  for (const anchor of CITY_ANCHORS) {
    try {
      const station = await fetchNearestPm25Station(anchor, apiKey, signal);
      if (!station) continue;

      const pm25 = await fetchSensorLatestValue(station.sensorId, apiKey, signal);
      // OpenAQ reporta lecturas negativas cuando el sensor esta descalibrado o sin datos validos.
      if (pm25 === null || pm25 < 0) continue;

      features.push({
        type: "Feature",
        id: station.sensorId,
        properties: {
          station: station.locationName,
          pm25,
          category: getAQICategory(pm25),
          updated: new Date().toISOString(),
        },
        geometry: {
          type: "Point",
          coordinates: [station.longitude, station.latitude],
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      console.error(`Error obteniendo calidad de aire para ${anchor.name}:`, error);
    }
  }

  if (features.length === 0) {
    console.error("Sin estaciones OpenAQ validas, usando datos de respaldo");
    return mockAirQualityGeoJSON();
  }

  return { type: "FeatureCollection", features };
}

export function mockAirQualityGeoJSON(): AirQualityGeoJSON {
  const stations = [
    { name: "Managua Centro", coords: [-86.2362, 12.1150], pm25: 14.5 },
    { name: "San Jose Downtown", coords: [-84.0875, 9.9333], pm25: 11.2 },
    { name: "Guatemala City Zona 1", coords: [-90.5133, 14.6407], pm25: 42.0 },
    { name: "Mexico City Zocalo", coords: [-99.1332, 19.4326], pm25: 58.3 },
    { name: "Bogota Chapinero", coords: [-74.0636, 4.6486], pm25: 22.8 },
    { name: "Lima Miraflores", coords: [-77.0316, -12.1217], pm25: 38.1 },
    { name: "Santiago Providencia", coords: [-70.6105, -33.4314], pm25: 65.4 },
    { name: "Madrid Gran Via", coords: [-3.7038, 40.4168], pm25: 9.8 },
    { name: "Tokyo Shinjuku", coords: [139.7034, 35.6938], pm25: 8.5 },
    { name: "Los Angeles Downtown", coords: [-118.2437, 34.0522], pm25: 28.6 }
  ];

  return {
    type: "FeatureCollection",
    features: stations.map((s, idx) => ({
      type: "Feature",
      id: idx + 1,
      properties: {
        station: s.name,
        pm25: s.pm25,
        category: getAQICategory(s.pm25),
        updated: new Date().toISOString()
      },
      geometry: {
        type: "Point",
        coordinates: [s.coords[0], s.coords[1]]
      }
    }))
  };
}
