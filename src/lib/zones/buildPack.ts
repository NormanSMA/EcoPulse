import type { GridForecast } from "../forecast/types";
import { bboxContains, expandBbox, type BBox } from "../geo";
import type {
  ActiveVolcanoFeature,
  CycloneFeature,
  DisasterFeature,
  EarthquakeFeature,
  FireFeature,
} from "../types";
import type { ZonePack, ZonePackEvents, ZoneSpec } from "./types";

export interface LiveEvents {
  earthquakes: EarthquakeFeature[];
  fires: FireFeature[];
  disasters: DisasterFeature[];
  cyclones: CycloneFeature[];
  volcanoes: ActiveVolcanoFeature[];
}

export const EVENT_MARGIN_KM = { tactical: 100, metro: 150, country: 200 } as const;
export const MAX_EVENTS_PER_KIND = 300;

function pointIn<T extends { geometry: { coordinates: readonly number[] } }>(bbox: BBox) {
  return (f: T) => {
    const [lon, lat] = f.geometry.coordinates;
    return bboxContains(bbox, lon, lat);
  };
}

function cycloneIn(bbox: BBox, c: CycloneFeature): boolean {
  const g = c.geometry;
  if (g.type === "Point") return bboxContains(bbox, g.coordinates[0], g.coordinates[1]);
  const vertices = g.type === "LineString" ? g.coordinates : g.coordinates.flat();
  return vertices.some(([lon, lat]) => bboxContains(bbox, lon, lat));
}

export function eventsInZone(zone: ZoneSpec, events: LiveEvents, capturedAt: number): ZonePackEvents {
  const box = expandBbox(zone.bbox, EVENT_MARGIN_KM[zone.tier]);
  const cap = <T>(list: T[]) => list.slice(0, MAX_EVENTS_PER_KIND);
  return {
    capturedAt,
    earthquakes: cap(
      events.earthquakes.filter(pointIn(box)).sort((a, b) => (b.properties.mag ?? -Infinity) - (a.properties.mag ?? -Infinity)),
    ),
    fires: cap(events.fires.filter(pointIn(box))),
    disasters: cap(events.disasters.filter(pointIn(box))),
    cyclones: cap(events.cyclones.filter((c) => cycloneIn(box, c))),
    volcanoes: cap(events.volcanoes.filter(pointIn(box))),
  };
}

export function buildPack(
  zone: ZoneSpec,
  forecast: GridForecast,
  events: LiveEvents,
  opts: { now: number; locale: "es" | "en" },
): ZonePack {
  const zoneEvents = eventsInZone(zone, events, opts.now);
  const eventCount =
    zoneEvents.earthquakes.length +
    zoneEvents.fires.length +
    zoneEvents.disasters.length +
    zoneEvents.cyclones.length +
    zoneEvents.volcanoes.length;
  const packForecast: GridForecast = { ...forecast, meta: { ...forecast.meta, source: "pack" } };
  const meta = {
    id: zone.id,
    zone,
    version: 1 as const,
    createdAt: opts.now,
    validFrom: forecast.time[0] ?? opts.now,
    validUntil: forecast.time[forecast.time.length - 1] ?? opts.now,
    horizonHours: 72 as const,
    pointCount: forecast.points.length,
    eventCount,
    sizeBytes: 0,
    locale: opts.locale,
  };
  const pack: ZonePack = { meta, forecast: packForecast, events: zoneEvents };
  // sizeBytes se mide sin el propio campo.
  const { sizeBytes: _omit, ...metaWithoutSize } = meta;
  void _omit;
  meta.sizeBytes = new TextEncoder().encode(JSON.stringify({ ...pack, meta: metaWithoutSize })).length;
  return pack;
}
