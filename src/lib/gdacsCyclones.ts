import type { AlertLevel, CycloneFeature, CycloneGeoJSON } from "./types";
import { normalizeStormCategory } from "@/design-system/tokens";

// Trayectorias y conos de incertidumbre de los ciclones tropicales activos,
// desde la API de geometrías de GDACS (la misma fuente que la capa de
// desastres, que solo trae un punto por evento).

const GDACS_TC_LIST = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC";
const MAX_ACTIVE = 8;

interface GdacsListFeature {
  properties: {
    eventid: number;
    episodeid: number;
    eventname?: string;
    name: string;
    alertlevel: string;
    iscurrent?: string | boolean;
    todate: string;
    url: { geometry?: string };
    severitydata?: { severity?: number; severityunit?: string };
  };
}

interface GdacsGeometryFeature {
  geometry: { type: string; coordinates: unknown };
  properties: { Class?: string; polygonlabel?: string };
}

function isAlert(v: string): v is AlertLevel {
  return v === "Green" || v === "Orange" || v === "Red";
}

/** "23/09 18:00 UTC" → ms, usando el año de referencia (con cruce de año). */
export function parseTrackLabel(label: string, reference: Date): number | null {
  const m = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})/.exec(label);
  if (!m) return null;
  const [, dd, mm, hh, mi] = m.map(Number) as unknown as number[];
  let year = reference.getUTCFullYear();
  // Un pronóstico de enero emitido en diciembre pertenece al año siguiente.
  if (reference.getUTCMonth() === 11 && mm === 1) year += 1;
  if (reference.getUTCMonth() === 0 && mm === 12) year -= 1;
  return Date.UTC(year, mm - 1, dd, hh, mi);
}

function ringCentroid(ring: [number, number][]): [number, number] {
  const pts = ring.slice(0, -1);
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

/**
 * Convierte la respuesta de geometrías de GDACS en features propias:
 * segmentos de trayectoria con su fase (TD/TS/HU) y si son pronóstico,
 * el cono de incertidumbre y la posición del último aviso.
 */
export function toCycloneFeatures(
  raw: GdacsGeometryFeature[],
  meta: { eventId: string; name: string; alertLevel: AlertLevel; advisoryTime: number; maxWindKmh?: number }
): CycloneFeature[] {
  const base = { eventId: meta.eventId, name: meta.name, alertLevel: meta.alertLevel };
  const reference = new Date(meta.advisoryTime);

  // Puntos de trayectoria (vienen como pequeños polígonos): índice → [pos, tiempo].
  const points = new Map<number, { pos: [number, number]; time: number | null }>();
  for (const f of raw) {
    const m = /^Point_Polygon_Point_(\d+)$/.exec(f.properties.Class ?? "");
    if (!m || f.geometry.type !== "Polygon") continue;
    const ring = (f.geometry.coordinates as [number, number][][])[0];
    points.set(Number(m[1]), { pos: ringCentroid(ring), time: parseTrackLabel(f.properties.polygonlabel ?? "", reference) });
  }
  const isForecast = (idx: number) => {
    const t = points.get(idx)?.time;
    return t != null && t > meta.advisoryTime;
  };

  const out: CycloneFeature[] = [];
  for (const f of raw) {
    const cls = f.properties.Class ?? "";
    const line = /^Line_Line_(\d+)$/.exec(cls);
    if (line && f.geometry.type === "LineString") {
      out.push({
        type: "Feature",
        properties: { ...base, kind: "track", category: normalizeStormCategory(f.properties.polygonlabel), forecast: isForecast(Number(line[1]) + 1) },
        geometry: { type: "LineString", coordinates: f.geometry.coordinates as [number, number][] },
      });
    } else if (cls === "Poly_Cones" && f.geometry.type === "Polygon") {
      out.push({
        type: "Feature",
        properties: { ...base, kind: "cone" },
        geometry: { type: "Polygon", coordinates: f.geometry.coordinates as [number, number][][] },
      });
    }
  }

  // Posición actual: el último punto observado (no pronóstico).
  const observed = [...points.entries()].filter(([i]) => !isForecast(i)).sort((a, b) => a[0] - b[0]);
  const current = observed[observed.length - 1]?.[1];
  if (current) {
    const lastTrack = out.filter((f) => f.properties.kind === "track" && !f.properties.forecast).pop();
    out.push({
      type: "Feature",
      properties: { ...base, kind: "position", category: lastTrack?.properties.category, ...(meta.maxWindKmh != null && { maxWindKmh: meta.maxWindKmh }) },
      geometry: { type: "Point", coordinates: current.pos },
    });
  }
  return out;
}

export async function fetchActiveCyclones(signal?: AbortSignal): Promise<CycloneGeoJSON> {
  try {
    const res = await fetch(GDACS_TC_LIST, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) throw new Error(`GDACS TC HTTP ${res.status}`);
    const list: { features: GdacsListFeature[] } = await res.json();
    const active = list.features
      .filter((f) => f.properties.iscurrent === true || f.properties.iscurrent === "true")
      .filter((f) => isAlert(f.properties.alertlevel) && f.properties.url.geometry)
      .slice(0, MAX_ACTIVE);

    const results = await Promise.all(
      active.map(async (f) => {
        const p = f.properties;
        try {
          const g = await fetch(p.url.geometry!, { headers: { Accept: "application/json" }, signal });
          if (!g.ok) return [];
          const geo: { features: GdacsGeometryFeature[] } = await g.json();
          return toCycloneFeatures(geo.features, {
            eventId: `TC-${p.eventid}`,
            name: p.eventname || p.name.replace(/^Tropical Cyclone\s+/i, ""),
            alertLevel: p.alertlevel as AlertLevel,
            advisoryTime: new Date(p.todate + (p.todate.endsWith("Z") ? "" : "Z")).getTime(),
            maxWindKmh: p.severitydata?.severityunit === "km/h" && Number.isFinite(p.severitydata.severity) ? p.severitydata.severity : undefined,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          return [];
        }
      })
    );
    return { type: "FeatureCollection", features: results.flat() };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo ciclones de GDACS:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
