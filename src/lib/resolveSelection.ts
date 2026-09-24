import type {
  EarthquakeFeature,
  FireFeature,
  DisasterFeature,
  CycloneFeature,
  ActiveVolcanoFeature,
  VolcanoFeature,
  AirQualityFeature,
  IssFeature,
} from "./types";
import type { MapData } from "@/components/map/types";
import type { Selection } from "./selection";
import { distanceKm } from "./format";

export type Resolved =
  | { kind: "quake"; f: EarthquakeFeature }
  | { kind: "fire"; f: FireFeature; nearby: number }
  | { kind: "disaster"; f: DisasterFeature }
  | { kind: "cyclone"; f: CycloneFeature }
  | { kind: "volcano"; f: ActiveVolcanoFeature }
  | { kind: "volcanoCatalog"; f: VolcanoFeature }
  | { kind: "air"; f: AirQualityFeature }
  | { kind: "iss"; f: IssFeature }
  | { kind: "point"; lon: number; lat: number; name?: string; detail?: string };

export interface ResolvedSelection {
  item: Resolved;
  coords: [number, number];
}

const NEARBY_FIRE_KM = 25;

/**
 * Busca el elemento seleccionado en los datos actuales. Devuelve null si ya
 * no existe (p.ej. quedó fuera de la ventana de tiempo tras un refresco).
 */
export function resolveSelection(sel: Selection | null, data: MapData, extraQuakes: EarthquakeFeature[] = []): ResolvedSelection | null {
  if (!sel) return null;
  const pt = (c: number[]): [number, number] => [c[0], c[1]];
  switch (sel.kind) {
    case "point":
      return { item: { kind: "point", lon: sel.lon, lat: sel.lat, name: sel.name, detail: sel.detail }, coords: [sel.lon, sel.lat] };
    case "iss": {
      const f = data.iss.features[0];
      return f ? { item: { kind: "iss", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "quake": {
      const f = data.earthquakes.features.find((q) => String(q.id) === sel.id) ?? extraQuakes.find((q) => String(q.id) === sel.id);
      return f ? { item: { kind: "quake", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "fire": {
      const f = data.fires.features.find((x) => String(x.id) === sel.id);
      if (!f) return null;
      const here = pt(f.geometry.coordinates);
      const nearby = data.fires.features.filter((x) => x !== f && distanceKm(here, pt(x.geometry.coordinates)) <= NEARBY_FIRE_KM).length;
      return { item: { kind: "fire", f, nearby }, coords: here };
    }
    case "disaster": {
      const f = data.disasters.features.find((x) => x.properties.eventId === sel.id);
      return f ? { item: { kind: "disaster", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "cyclone": {
      const f = data.cyclones.features.find((x) => x.properties.kind === "position" && x.properties.eventId === sel.id);
      return f && f.geometry.type === "Point" ? { item: { kind: "cyclone", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "volcano": {
      const f = data.volcanoes.features.find((x) => x.id === sel.id);
      return f ? { item: { kind: "volcano", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "volcanoCatalog": {
      const f = data.volcanoCatalog?.features.find((x) => x.id === sel.id);
      return f ? { item: { kind: "volcanoCatalog", f }, coords: pt(f.geometry.coordinates) } : null;
    }
    case "air": {
      const f = data.airQuality.features.find((x) => Number(x.id) === sel.id);
      return f ? { item: { kind: "air", f }, coords: pt(f.geometry.coordinates) } : null;
    }
  }
}
