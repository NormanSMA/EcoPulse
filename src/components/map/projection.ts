import type maplibregl from "maplibre-gl";
import { themes } from "@/design-system/tokens";

export type MapProjection = "mercator" | "globe";

export function applyProjection(map: maplibregl.Map, projection: MapProjection, onLight = false): void {
  if (map.getProjection?.()?.type !== projection) map.setProjection({ type: projection });

  if (projection === "mercator") {
    // Un objeto vacío conserva el cielo anterior en MapLibre 5.24.
    map.setSky({
      "sky-color": "transparent",
      "horizon-color": "transparent",
      "fog-color": "transparent",
      "sky-horizon-blend": 0,
      "horizon-fog-blend": 0,
      "fog-ground-blend": 1,
      "atmosphere-blend": 0,
    });
    return;
  }

  map.setSky({
    "sky-color": onLight ? themes.light.secondaryContainer : themes.dark.canvas,
    "horizon-color": onLight ? themes.light.surface : themes.dark.primaryStrong,
    "fog-color": onLight ? themes.light.canvas : themes.dark.canvasDeep,
    "sky-horizon-blend": onLight ? 0.4 : 0.6,
    "horizon-fog-blend": 0.5,
    "fog-ground-blend": 0.9,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 3, 1, 7, 0],
  });
}

export function introStartZoom(finalZoom: number): number {
  return Math.max(0.6, Math.min(finalZoom - 2.2, 1.2));
}

export function shouldPlayIntro(storage: Pick<Storage, "getItem" | "setItem"> | null, reducedMotion: boolean): boolean {
  if (reducedMotion || !storage) return false;
  try {
    if (storage.getItem("ecopulse-intro-seen") === "true") return false;
    storage.setItem("ecopulse-intro-seen", "true");
    return true;
  } catch {
    return false;
  }
}
