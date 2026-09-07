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
