// Resumen compacto para widgets de pantalla de inicio (Scriptable en iPhone,
// KWGT en Android). Solo datos y colores de tokens; el texto lo arma el widget.

import type { EarthquakeFeature, CycloneFeature, ActiveVolcanoFeature, DisasterFeature } from "./types";
import { magnitudeColor, stormColor, alertColor, marker } from "@/design-system/tokens";
import { distanceKm } from "./format";
import { entityIdFor } from "./selection";

export interface WidgetQuake {
  mag: number;
  place: string;
  time: number;
  depthKm: number;
  color: string;
  url: string;
  distanceKm?: number;
}

export interface WidgetSummary {
  generated: number;
  quakes: { count24h: number; countM5: number; strongest: WidgetQuake | null; nearest: WidgetQuake | null };
  cyclones: { name: string; category: string; color: string; url: string }[];
  eruptions: { name: string; country: string; color: string; url: string }[];
  alerts: { name: string; level: string; color: string; url: string }[];
  url: string;
}

interface Sources {
  quakes: EarthquakeFeature[];
  cyclones: CycloneFeature[];
  volcanoes: ActiveVolcanoFeature[];
  disasters: DisasterFeature[];
}

const link = (appUrl: string, id: string | null) => (id ? `${appUrl}/?sel=${encodeURIComponent(id)}` : appUrl);

function toQuake(f: EarthquakeFeature, appUrl: string): WidgetQuake {
  const mag = f.properties.mag ?? 0;
  return {
    mag: Math.round(mag * 10) / 10,
    place: f.properties.place,
    time: f.properties.time,
    depthKm: Math.round(f.geometry.coordinates[2] ?? 0),
    color: magnitudeColor(mag),
    url: link(appUrl, entityIdFor({ kind: "quake", id: String(f.id) })),
  };
}

/**
 * Arma el resumen. `near` opcional: sismo M ≥ 4 más cercano (hasta 1000 km)
 * a la ubicación del usuario.
 */
export function buildWidgetSummary(src: Sources, appUrl: string, now: number, near?: { lat: number; lon: number }): WidgetSummary {
  const recent = src.quakes.filter((q) => now - q.properties.time <= 24 * 3_600_000);
  const strongest = recent.reduce<EarthquakeFeature | null>((m, q) => (!m || (q.properties.mag ?? 0) > (m.properties.mag ?? 0) ? q : m), null);

  let nearest: WidgetQuake | null = null;
  if (near) {
    let best: { f: EarthquakeFeature; d: number } | null = null;
    for (const q of recent) {
      if ((q.properties.mag ?? 0) < 4) continue;
      const d = distanceKm([near.lon, near.lat], [q.geometry.coordinates[0], q.geometry.coordinates[1]]);
      if (d <= 1000 && (!best || d < best.d)) best = { f: q, d };
    }
    if (best) nearest = { ...toQuake(best.f, appUrl), distanceKm: Math.round(best.d) };
  }

  return {
    generated: now,
    quakes: {
      count24h: recent.length,
      countM5: recent.filter((q) => (q.properties.mag ?? 0) >= 5).length,
      strongest: strongest ? toQuake(strongest, appUrl) : null,
      nearest,
    },
    cyclones: src.cyclones
      .filter((c) => c.properties.kind === "position")
      .map((c) => ({
        name: c.properties.name,
        category: c.properties.category ?? "TS",
        color: stormColor(c.properties.category ?? "TS"),
        url: link(appUrl, entityIdFor({ kind: "cyclone", id: c.properties.eventId })),
      })),
    eruptions: src.volcanoes
      .filter((v) => v.properties.status === "new")
      .map((v) => ({
        name: v.properties.name,
        country: v.properties.country,
        color: marker.volcanoNew,
        url: link(appUrl, entityIdFor({ kind: "volcano", id: v.id })),
      })),
    alerts: src.disasters
      .filter((d) => d.properties.alertLevel !== "Green")
      .map((d) => ({
        name: d.properties.name,
        level: d.properties.alertLevel,
        color: alertColor(d.properties.alertLevel),
        url: link(appUrl, entityIdFor({ kind: "disaster", id: d.properties.eventId })),
      })),
    url: appUrl,
  };
}
