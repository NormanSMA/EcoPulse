import { EarthquakeFeature, AirQualityFeature, FireFeature, WeatherFeature, DisasterFeature, IssFeature, VolcanoFeature, AirQualityModelFeature } from "./types";

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

export function toFireRow(feature: FireFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    fire_key: feature.properties.fireKey,
    brightness: feature.properties.brightness,
    frp: feature.properties.frp,
    confidence: feature.properties.confidence,
    satellite: feature.properties.satellite,
    acquired_at: feature.properties.acquiredAt,
    location: `SRID=4326;POINT(${lon} ${lat})`,
  };
}

export function toWeatherRow(feature: WeatherFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    city: feature.properties.city,
    temperature: feature.properties.temperature,
    humidity: feature.properties.humidity,
    wind_speed: feature.properties.windSpeed,
    wind_direction: feature.properties.windDirection,
    weather_code: feature.properties.weatherCode,
    location: `SRID=4326;POINT(${lon} ${lat})`,
    measured_at: feature.properties.updated,
  };
}

export function toDisasterRow(feature: DisasterFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    event_id: feature.properties.eventId,
    event_type: feature.properties.eventType,
    name: feature.properties.name,
    country: feature.properties.country,
    alert_level: feature.properties.alertLevel,
    from_date: feature.properties.fromDate,
    to_date: feature.properties.toDate,
    report_url: feature.properties.reportUrl,
    location: `SRID=4326;POINT(${lon} ${lat})`,
  };
}

export function toIssRow(feature: IssFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    id: "current",
    altitude_km: feature.properties.altitudeKm,
    velocity_kms: feature.properties.velocityKmS,
    observed_at: feature.properties.timestamp,
    location: `SRID=4326;POINT(${lon} ${lat})`,
  };
}

export function toVolcanoRow(feature: VolcanoFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    volcano_number: feature.properties.volcanoNumber,
    name: feature.properties.name,
    country: feature.properties.country,
    volcano_type: feature.properties.volcanoType,
    last_eruption_year: feature.properties.lastEruptionYear,
    elevation_m: feature.properties.elevationM,
    location: `SRID=4326;POINT(${lon} ${lat})`,
  };
}

export function toAirQualityModelRow(feature: AirQualityModelFeature) {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    city: feature.properties.city,
    pm25_value: feature.properties.pm25,
    aqi_category: feature.properties.category,
    location: `SRID=4326;POINT(${lon} ${lat})`,
    measured_at: feature.properties.updated,
  };
}

export function dedupeByKey<T, K extends keyof T>(rows: T[], key: K): T[] {
  const seen = new Map<T[K], T>();
  for (const row of rows) {
    seen.set(row[key], row);
  }
  return Array.from(seen.values());
}

export function isIngestAuthorized(
  request: Request,
  secret: string | undefined,
  isProduction: boolean = process.env.NODE_ENV === "production"
): boolean {
  // Sin secreto solo se permite en desarrollo: en producción un
  // INGEST_SECRET olvidado dejaría /api/ingest (service role) abierto.
  if (!secret) return !isProduction;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
