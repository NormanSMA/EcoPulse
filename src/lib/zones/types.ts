import type { BBox } from "../geo";
import type { ForecastHorizon, GridForecast } from "../forecast/types";
import type { ActiveVolcanoFeature, CycloneFeature, DisasterFeature, EarthquakeFeature, FireFeature } from "../types";

// Zonas de descarga y paquetes sin conexión.

export type ZoneTier = "tactical" | "metro" | "country";

export interface ZoneSpec {
  /** "tactical:<lat>,<lon>" | "metro:<lat>,<lon>" | "metro:ni-<departamento>" | "country:ni" */
  id: string;
  tier: ZoneTier;
  name: string;
  bbox: BBox;
  center: [lon: number, lat: number];
  /** Paso de la retícula global a la que se ajustan los puntos (grados). */
  stepDeg: number;
  maxPoints: number;
}

export interface ZonePackMeta {
  /** Igual a zone.id: una zona guarda un solo paquete, el más reciente. */
  id: string;
  zone: ZoneSpec;
  version: 1;
  createdAt: number;
  /** Primera y última hora del pronóstico (ms epoch). */
  validFrom: number;
  validUntil: number;
  horizonHours: ForecastHorizon;
  pointCount: number;
  eventCount: number;
  sizeBytes: number;
  locale: "es" | "en";
}

export interface ZonePackEvents {
  capturedAt: number;
  earthquakes: EarthquakeFeature[];
  fires: FireFeature[];
  disasters: DisasterFeature[];
  cyclones: CycloneFeature[];
  volcanoes: ActiveVolcanoFeature[];
}

export interface ZonePack {
  meta: ZonePackMeta;
  forecast: GridForecast;
  events: ZonePackEvents;
}

export type ExportFormat = "json" | "csv" | "report";

export interface ExportFile {
  filename: string;
  mime: string;
  content: string;
}
