export interface CityAnchor {
  name: string;
  lat: number;
  lon: number;
}

export const CITY_ANCHORS: CityAnchor[] = [
  { name: "Managua", lat: 12.1150, lon: -86.2362 },
  { name: "San Jose", lat: 9.9333, lon: -84.0875 },
  { name: "Guatemala City", lat: 14.6407, lon: -90.5133 },
  { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
  { name: "Bogota", lat: 4.6486, lon: -74.0636 },
  { name: "Lima", lat: -12.1217, lon: -77.0316 },
  { name: "Santiago", lat: -33.4314, lon: -70.6105 },
  { name: "Madrid", lat: 40.4168, lon: -3.7038 },
  { name: "Tokyo", lat: 35.6938, lon: 139.7034 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
];
