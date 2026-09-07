import { FireConfidence, FireFeature, FireGeoJSON } from "./types";

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const SOURCE = "VIIRS_NOAA20_NRT";
const MIN_FRP = 10;

const CONFIDENCE_MAP: Record<string, FireConfidence> = {
  l: "low",
  n: "nominal",
  h: "high",
};

interface RawFireRow {
  latitude: number;
  longitude: number;
  brightness: number;
  frp: number;
  confidence: FireConfidence;
  satellite: string;
  acq_date: string;
  acq_time: string;
}

export function parseFirmsCsv(csv: string): RawFireRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const latIdx = col("latitude");
  const lonIdx = col("longitude");
  const brightIdx = col("bright_ti4");
  const frpIdx = col("frp");
  const confIdx = col("confidence");
  const satIdx = col("satellite");
  const dateIdx = col("acq_date");
  const timeIdx = col("acq_time");

  const rows: RawFireRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells.length < header.length) continue;

    const rawConfidence = cells[confIdx]?.trim();
    const confidence = CONFIDENCE_MAP[rawConfidence];
    if (!confidence) continue;

    rows.push({
      latitude: Number(cells[latIdx]),
      longitude: Number(cells[lonIdx]),
      brightness: Number(cells[brightIdx]),
      frp: Number(cells[frpIdx]),
      confidence,
      satellite: cells[satIdx]?.trim(),
      acq_date: cells[dateIdx]?.trim(),
      acq_time: cells[timeIdx]?.trim(),
    });
  }
  return rows;
}

export function toAcquiredAtIso(acqDate: string, acqTime: string): string {
  const paddedTime = acqTime.padStart(4, "0");
  const hours = paddedTime.slice(0, 2);
  const minutes = paddedTime.slice(2, 4);
  return new Date(`${acqDate}T${hours}:${minutes}:00Z`).toISOString();
}

export function toFireFeature(row: RawFireRow): FireFeature {
  const acquiredAt = toAcquiredAtIso(row.acq_date, row.acq_time);
  const fireKey = `${row.latitude.toFixed(3)}_${row.longitude.toFixed(3)}_${row.acq_date}_${row.acq_time}_${row.satellite}`;
  return {
    type: "Feature",
    id: fireKey,
    properties: {
      fireKey,
      brightness: row.brightness,
      frp: row.frp,
      confidence: row.confidence,
      satellite: row.satellite,
      acquiredAt,
    },
    geometry: {
      type: "Point",
      coordinates: [row.longitude, row.latitude],
    },
  };
}

export function isSignificantFire(row: RawFireRow): boolean {
  return row.confidence === "high" && row.frp >= MIN_FRP;
}

export async function fetchLiveFires(signal?: AbortSignal): Promise<FireGeoJSON> {
  const mapKey = process.env.NASA_FIRMS_MAP_KEY;
  if (!mapKey) {
    console.error("NASA_FIRMS_MAP_KEY no configurada, sin datos de incendios");
    return { type: "FeatureCollection", features: [] };
  }

  // Sin fecha explicita: FIRMS decide la ventana mas reciente disponible.
  // NRT tiene rezago de procesamiento, "hoy" en UTC suele no tener datos aun.
  const url = `${FIRMS_BASE}/${mapKey}/${SOURCE}/world/2`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`FIRMS HTTP ${res.status}`);
    }
    const csv = await res.text();
    const rows = parseFirmsCsv(csv).filter(isSignificantFire);
    return {
      type: "FeatureCollection",
      features: rows.map(toFireFeature),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo incendios de NASA FIRMS:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
