import { EarthquakeFeature, AirQualityFeature } from "./types";

export function toEarthquakeRow(feature: EarthquakeFeature) {
  const [lon, lat, depth] = feature.geometry.coordinates;
  return {
    usgs_id: String(feature.id),
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    depth: depth ?? null,
    alert: feature.properties.alert,
    event_time: new Date(feature.properties.time).toISOString(),
    location: `SRID=4326;POINT(${lon} ${lat})`,
  };
}

export function toAirQualityRow(feature: AirQualityFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    station_id: String(feature.id),
    station_name: feature.properties.station,
    pm25_value: feature.properties.pm25,
    aqi_category: feature.properties.category,
    location: `SRID=4326;POINT(${lon} ${lat})`,
    measured_at: feature.properties.updated,
  };
}

export function isIngestAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
