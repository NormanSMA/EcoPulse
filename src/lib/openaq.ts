import { AQICategory, AirQualityGeoJSON } from "./types";

export function getAQICategory(pm25: number): AQICategory {
  if (pm25 <= 12.0) return "good";
  if (pm25 <= 35.4) return "moderate";
  if (pm25 <= 55.4) return "unhealthy";
  return "hazardous";
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
