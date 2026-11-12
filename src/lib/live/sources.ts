import { loadMergedEarthquakes, type QuakePeriod } from "../earthquakes";
import { loadFires } from "../firms";
import { loadDisasters } from "../gdacs";
import { loadCyclones } from "../gdacsCyclones";
import { loadActiveVolcanoes } from "../gvpWeekly";
import { loadIss } from "../iss";
import type {
  ActiveVolcanoGeoJSON,
  CycloneGeoJSON,
  DisasterGeoJSON,
  EarthquakeGeoJSON,
  FireGeoJSON,
  IssGeoJSON,
} from "../types";
import { loadBundle, loadSource, type BundleId, type LiveBundle, type SourceDef } from "./bundle";

// Registro único de fuentes en vivo. La web, el widget y el despacho de
// alertas push piden lo mismo desde aquí: un solo lugar para TTL y timeout.

const noFeatures = (collection: { features: unknown[] }) => collection.features.length === 0;

const fires: SourceDef<FireGeoJSON> = { load: loadFires, ttlSeconds: 900, timeoutMs: 12_000, isEmpty: noFeatures };
const disasters: SourceDef<DisasterGeoJSON> = { load: loadDisasters, ttlSeconds: 900, isEmpty: noFeatures };
const cyclones: SourceDef<CycloneGeoJSON> = { load: loadCyclones, ttlSeconds: 1800, timeoutMs: 12_000, isEmpty: noFeatures };
const volcanoes: SourceDef<ActiveVolcanoGeoJSON> = { load: loadActiveVolcanoes, ttlSeconds: 3600, isEmpty: noFeatures };
const iss: SourceDef<IssGeoJSON> = { load: (signal) => loadIss(signal), ttlSeconds: 300, isEmpty: noFeatures };

const earthquakes = (period: QuakePeriod): SourceDef<EarthquakeGeoJSON> => ({
  load: (signal) => loadMergedEarthquakes(period, signal),
  ttlSeconds: period === "week" ? 900 : 120,
  timeoutMs: 12_000,
  isEmpty: noFeatures,
});

export type PulseSources = { earthquakes: EarthquakeGeoJSON };
export type HazardsSources = {
  fires: FireGeoJSON;
  disasters: DisasterGeoJSON;
  cyclones: CycloneGeoJSON;
  volcanoes: ActiveVolcanoGeoJSON;
};
export type OrbitSources = { iss: IssGeoJSON };

export type PulseBundle = LiveBundle<PulseSources>;
export type HazardsBundle = LiveBundle<HazardsSources>;
export type OrbitBundle = LiveBundle<OrbitSources>;
export type AnyLiveBundle = PulseBundle | HazardsBundle | OrbitBundle;

/** La efeméride de la ISS cubre 30 min: el CDN nunca debe servirla más vieja que eso. */
const ORBIT_SWR_SECONDS = 300;

export const BUNDLE_SWR_SECONDS: Partial<Record<BundleId, number>> = { orbit: ORBIT_SWR_SECONDS };

export function isBundleId(value: string): value is BundleId {
  return value === "pulse" || value === "hazards" || value === "orbit";
}

export function loadLiveBundle(id: BundleId, period: QuakePeriod, signal?: AbortSignal): Promise<AnyLiveBundle> {
  switch (id) {
    case "pulse": {
      const def = earthquakes(period);
      return loadBundle<PulseSources>("pulse", { earthquakes: def }, { ttlSeconds: def.ttlSeconds, signal });
    }
    case "hazards":
      return loadBundle<HazardsSources>("hazards", { fires, disasters, cyclones, volcanoes }, { ttlSeconds: 900, signal });
    case "orbit":
      return loadBundle<OrbitSources>("orbit", { iss }, { ttlSeconds: iss.ttlSeconds, swrSeconds: ORBIT_SWR_SECONDS, signal });
  }
}

export interface EventSources {
  quakes: EarthquakeGeoJSON["features"];
  cyclones: CycloneGeoJSON["features"];
  volcanoes: ActiveVolcanoGeoJSON["features"];
  disasters: DisasterGeoJSON["features"];
}

/**
 * Eventos para el widget y las alertas push. Una fuente caída aporta una
 * lista vacía y no detiene a las demás.
 */
export async function loadEventSources(signal?: AbortSignal): Promise<EventSources> {
  const [quakes, cyc, vol, dis] = await Promise.all([
    loadSource(earthquakes("day"), signal),
    loadSource(cyclones, signal),
    loadSource(volcanoes, signal),
    loadSource(disasters, signal),
  ]);
  return {
    quakes: quakes.data?.features ?? [],
    cyclones: cyc.data?.features ?? [],
    volcanoes: vol.data?.features ?? [],
    disasters: dis.data?.features ?? [],
  };
}
