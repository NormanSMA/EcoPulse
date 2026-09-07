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

export interface IssProperties {
  altitudeKm: number;
  velocityKmS: number;
  timestamp: string;
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
