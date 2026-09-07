import { useMemo } from "react";
import type { SimpleStatus } from "@/components/ui/StatusBadge";

// UI pura: deriva LIVE/RECENT/STALE en el cliente a partir de un timestamp
// que YA existe en cada fuente (ej. EarthquakeGeoJSON.metadata.generated,
// AirQualityProperties.updated, IssProperties.timestamp). No agrega campos
// nuevos a src/lib/types.ts, no toca ingest.ts ni las tablas de Supabase.
const DEFAULT_THRESHOLDS_MIN = { live: 10, recent: 60 };

export function getFreshness(
  timestamp: string | number | null | undefined,
  thresholdsMin: { live: number; recent: number } = DEFAULT_THRESHOLDS_MIN
): SimpleStatus {
  if (timestamp === null || timestamp === undefined) return "unknown";

  const timestampMs = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (Number.isNaN(timestampMs)) return "unknown";

  const ageMinutes = (Date.now() - timestampMs) / 60000;
  if (ageMinutes < thresholdsMin.live) return "live";
  if (ageMinutes < thresholdsMin.recent) return "recent";
  return "stale";
}

export function useFreshness(
  timestamp: string | number | null | undefined,
  thresholdsMin: { live: number; recent: number } = DEFAULT_THRESHOLDS_MIN
): SimpleStatus {
  const { live, recent } = thresholdsMin;
  return useMemo(() => getFreshness(timestamp, { live, recent }), [timestamp, live, recent]);
}
