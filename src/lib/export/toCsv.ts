import type { ExportFile, ZonePack } from "../zones/types";
import { exportBaseName } from "./toJson";

const BOM = "﻿";
const EOL = "\r\n";

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface FlatEvent {
  kind: string;
  id: string;
  time: string | null;
  lat: number | null;
  lon: number | null;
  magnitude: number | null;
  title: string;
  url: string;
}

function firstCoord(c: unknown): [number, number] | null {
  if (!Array.isArray(c)) return null;
  if (typeof c[0] === "number" && typeof c[1] === "number") return [c[0], c[1]];
  return firstCoord(c[0]);
}

export function flattenEvents(pack: ZonePack): FlatEvent[] {
  const { earthquakes, fires, disasters, cyclones, volcanoes } = pack.events;
  const out: FlatEvent[] = [];
  for (const f of earthquakes) {
    out.push({
      kind: "earthquake",
      id: String(f.id),
      time: isoOrNull(f.properties.time),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      magnitude: f.properties.mag,
      title: f.properties.place,
      url: f.properties.url,
    });
  }
  for (const f of fires) {
    out.push({
      kind: "fire",
      id: String(f.id),
      time: isoOrNull(f.properties.acquiredAt),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      magnitude: f.properties.frp,
      title: `${f.properties.satellite} ${f.properties.confidence}`,
      url: "",
    });
  }
  for (const f of disasters) {
    out.push({
      kind: "disaster",
      id: f.properties.eventId,
      time: isoOrNull(f.properties.fromDate),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      magnitude: null,
      title: `${f.properties.name} (${f.properties.country})`,
      url: f.properties.reportUrl,
    });
  }
  for (const f of cyclones) {
    const c = firstCoord(f.geometry.coordinates);
    out.push({
      kind: "cyclone",
      id: f.properties.eventId,
      time: null,
      lon: c ? c[0] : null,
      lat: c ? c[1] : null,
      magnitude: f.properties.maxWindKmh ?? null,
      title: f.properties.name,
      url: "",
    });
  }
  for (const f of volcanoes) {
    out.push({
      kind: "volcano",
      id: String(f.id),
      time: isoOrNull(f.properties.published),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      magnitude: null,
      title: `${f.properties.name} (${f.properties.country})`,
      url: f.properties.reportUrl,
    });
  }
  return out;
}

const FORECAST_HEADER = [
  "point_id", "label", "lat", "lon", "time_utc", "temperature_c", "apparent_c", "humidity_pct", "pressure_hpa",
  "cloud_cover_pct", "precip_prob_pct", "precip_mm", "wind_kmh", "wind_dir_deg", "gust_kmh", "uv_index",
  "weather_code", "pm25", "pm10", "us_aqi",
];
const EVENTS_HEADER = ["kind", "id", "time_utc", "lat", "lon", "magnitude", "title", "url"];

export function toCsv(pack: ZonePack): ExportFile[] {
  const base = exportBaseName(pack);
  const { points, time, weather, air } = pack.forecast;
  const lines = [row(FORECAST_HEADER)];
  points.forEach((p, n) => {
    const w = weather[n];
    const a = air[n];
    time.forEach((t, i) => {
      lines.push(
        row([
          p.id, p.label, p.lat, p.lon, new Date(t).toISOString(), w.temperature[i], w.apparentTemperature[i],
          w.humidity[i], w.surfacePressure[i], w.cloudCover[i], w.precipitationProbability[i], w.precipitation[i],
          w.windSpeed[i], w.windDirection[i], w.windGusts[i], w.uvIndex[i], w.weatherCode[i],
          a?.pm25[i], a?.pm10[i], a?.usAqi[i],
        ]),
      );
    });
  });
  const events = [row(EVENTS_HEADER)];
  for (const e of flattenEvents(pack)) events.push(row([e.kind, e.id, e.time, e.lat, e.lon, e.magnitude, e.title, e.url]));
  return [
    { filename: `${base}-forecast.csv`, mime: "text/csv", content: BOM + lines.join(EOL) + EOL },
    { filename: `${base}-events.csv`, mime: "text/csv", content: BOM + events.join(EOL) + EOL },
  ];
}
