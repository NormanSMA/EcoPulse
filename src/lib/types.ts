export interface EarthquakeProperties {
  mag: number | null;
  place: string;
  time: number;
  updated: number;
  url: string;
  alert: "green" | "yellow" | "orange" | "red" | null;
  status: string;
  tsunami: number;
  sig: number;
  /** Tipo de magnitud (mb, ml, mww…). */
  magType?: string;
  /** Reportes "¿Lo sentiste?" de USGS. */
  felt?: number | null;
  /** Agencia de origen tras la fusión USGS + EMSC. */
  source?: "USGS" | "EMSC";
}

export interface EarthquakeFeature {
  type: "Feature";
  id: string | number;
  properties: EarthquakeProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // [longitude, latitude, depthKm]
  };
}

export interface EarthquakeGeoJSON {
  type: "FeatureCollection";
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

export type AQICategory = "good" | "moderate" | "unhealthy" | "hazardous";

export interface AirQualityProperties {
  station: string;
  pm25: number;
  category: AQICategory;
  updated: string;
  /** Ids de OpenAQ (cobertura global) para pedir nombre e historial. */
  locationId?: number;
  sensorId?: number;
}

export interface AirQualityFeature {
  type: "Feature";
  id: string | number;
  properties: AirQualityProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface AirQualityGeoJSON {
  type: "FeatureCollection";
  features: AirQualityFeature[];
}

export type FireConfidence = "low" | "nominal" | "high";

export interface FireProperties {
  fireKey: string;
  brightness: number;
  frp: number;
  confidence: FireConfidence;
  satellite: string;
  acquiredAt: string;
}

export interface FireFeature {
  type: "Feature";
  id: string;
  properties: FireProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface FireGeoJSON {
  type: "FeatureCollection";
  features: FireFeature[];
}

export interface WeatherProperties {
  city: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  weatherDescription: string;
  updated: string;
}

export interface WeatherFeature {
  type: "Feature";
  id: string;
  properties: WeatherProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface WeatherGeoJSON {
  type: "FeatureCollection";
  features: WeatherFeature[];
}

export type DisasterEventType = "FL" | "TC" | "DR" | "VO";
export type AlertLevel = "Green" | "Orange" | "Red";

export interface DisasterProperties {
  eventId: string;
  eventType: DisasterEventType;
  eventTypeLabel: string;
  name: string;
  country: string;
  alertLevel: AlertLevel;
  fromDate: string | null;
  toDate: string | null;
  reportUrl: string;
}

export interface DisasterFeature {
  type: "Feature";
  id: string;
  properties: DisasterProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface DisasterGeoJSON {
  type: "FeatureCollection";
  features: DisasterFeature[];
}

/** Punto de trayectoria: [longitud, latitud, altitud km]. */
export type TrackPoint = [number, number, number];

export interface IssProperties {
  altitudeKm: number;
  velocityKmS: number;
  timestamp: string;
  /** Rumbo sobre el terreno en grados (0 = norte). */
  headingDeg?: number;
  /** Trayectoria real desde las efemérides OEM: pasada y futura. */
  track?: { past: TrackPoint[]; future: TrackPoint[] };
}

export interface IssFeature {
  type: "Feature";
  id: "iss";
  properties: IssProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface IssGeoJSON {
  type: "FeatureCollection";
  features: IssFeature[];
}

export interface VolcanoProperties {
  volcanoNumber: number;
  name: string;
  country: string;
  volcanoType: string;
  lastEruptionYear: number | null;
  /** Código de periodo de NCEI/GVP (D1 = 1964 o después … D7 = a.C., U = sin fecha). */
  lastEruptionPeriod?: string;
  elevationM: number | null;
}

export interface VolcanoFeature {
  type: "Feature";
  id: number;
  properties: VolcanoProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface VolcanoGeoJSON {
  type: "FeatureCollection";
  features: VolcanoFeature[];
}

export type ModeledAQICategory = AQICategory;

export interface AirQualityModelProperties {
  city: string;
  pm25: number;
  category: ModeledAQICategory;
  updated: string;
}

export interface AirQualityModelFeature {
  type: "Feature";
  id: string;
  properties: AirQualityModelProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface AirQualityModelGeoJSON {
  type: "FeatureCollection";
  features: AirQualityModelFeature[];
}

export interface NearbyEarthquakeRow {
  id: string;
  usgs_id: string;
  magnitude: number | null;
  place: string;
  depth: number | null;
  alert: "green" | "yellow" | "orange" | "red" | null;
  event_time: string;
}

export interface SystemHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  services: {
    usgsApi: "online" | "unreachable";
    supabase: "connected" | "disconnected" | "unconfigured";
  };
}

export type StormCategory = "TD" | "TS" | "HU";

export interface CycloneProperties {
  eventId: string;
  name: string;
  alertLevel: AlertLevel;
  /** track = segmento de trayectoria, cone = cono de incertidumbre, position = posición actual. */
  kind: "track" | "cone" | "position";
  category?: string;
  forecast?: boolean;
  /** Viento sostenido máximo del evento según GDACS (km/h). */
  maxWindKmh?: number;
}

export interface CycloneFeature {
  type: "Feature";
  properties: CycloneProperties;
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Polygon"; coordinates: [number, number][][] }
    | { type: "Point"; coordinates: [number, number] };
}

export interface CycloneGeoJSON {
  type: "FeatureCollection";
  features: CycloneFeature[];
}

export interface ActiveVolcanoProperties {
  name: string;
  country: string;
  /** Periodo del reporte ("10 September-16 September 2026"). */
  period: string;
  /** new = nueva actividad eruptiva esta semana; continuing = continúa. */
  status: "new" | "continuing";
  summary: string;
  sources: string | null;
  reportUrl: string;
  published: string | null;
}

export interface ActiveVolcanoFeature {
  type: "Feature";
  id: number;
  properties: ActiveVolcanoProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
}

export interface ActiveVolcanoGeoJSON {
  type: "FeatureCollection";
  features: ActiveVolcanoFeature[];
}
