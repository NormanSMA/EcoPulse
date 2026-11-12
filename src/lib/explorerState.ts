// Estado unico del explorador: seleccion, camara y paneles. Reducer puro.
import { haversineKm } from "./geo";
import type { Selection } from "./selection";

export type Layout = "mobile" | "medium" | "wide"; // <1024 px | 1024-1279 | >=1280
export interface SpatialFilter {
  center: [lon: number, lat: number];
  radiusKm: number;
  label?: string;
}
export type RightPanel = "events" | "detail" | null;

export interface ExplorerState {
  selection: Selection | null;
  focus: { lng: number; lat: number; key: number } | null;
  spatialFilter: SpatialFilter | null;
  userLocation: [lon: number, lat: number] | null;
  left: boolean;
  right: RightPanel;
}

export type ExplorerAction =
  | { type: "layout"; layout: Layout }
  | { type: "select"; selection: Selection; fly?: [lon: number, lat: number]; layout: Layout; now: number }
  | { type: "clearSelection"; layout: Layout }
  | { type: "openLeft"; layout: Layout }
  | { type: "closeLeft" }
  | { type: "openRight"; layout: Layout }
  | { type: "closeRight"; layout: Layout }
  | { type: "focus"; at: [lon: number, lat: number]; now: number }
  | { type: "clearFocus" }
  | { type: "setFilter"; filter: SpatialFilter | null }
  | { type: "located"; at: [lon: number, lat: number] };

export function initialExplorerState(layout: Layout): ExplorerState {
  return {
    selection: null,
    focus: null,
    spatialFilter: null,
    userLocation: null,
    left: layout === "wide",
    right: layout === "mobile" ? null : "events",
  };
}

/** Aplica el cambio; devuelve el mismo objeto si ningun campo cambia. */
function patch(state: ExplorerState, changes: Partial<ExplorerState>): ExplorerState {
  const keys = Object.keys(changes) as (keyof ExplorerState)[];
  return keys.every((k) => state[k] === changes[k]) ? state : { ...state, ...changes };
}

export function explorerReducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  switch (action.type) {
    case "layout": {
      if (action.layout === "mobile") return patch(state, { left: false, right: state.selection ? "detail" : null });
      const left = action.layout === "medium" && state.left && state.right ? false : state.left;
      const right = state.right === null && state.selection ? "detail" : state.right;
      return patch(state, { left, right });
    }
    case "select":
      return patch(state, {
        selection: action.selection,
        focus: action.fly ? { lng: action.fly[0], lat: action.fly[1], key: action.now } : state.focus,
        right: "detail",
        left: action.layout === "wide" ? state.left : false,
      });
    case "clearSelection":
      return patch(state, { selection: null, right: action.layout === "mobile" ? null : "events" });
    case "openLeft":
      return patch(state, { left: true, right: action.layout === "wide" ? state.right : null });
    case "closeLeft":
      return patch(state, { left: false });
    case "openRight":
      return patch(state, { right: state.selection ? "detail" : "events", left: action.layout === "wide" ? state.left : false });
    case "closeRight":
      return patch(state, {
        right: null,
        selection: action.layout === "mobile" && state.right === "detail" ? null : state.selection,
      });
    case "focus":
      return patch(state, { focus: { lng: action.at[0], lat: action.at[1], key: action.now } });
    case "clearFocus":
      return patch(state, { focus: null });
    case "setFilter":
      return patch(state, { spatialFilter: action.filter });
    case "located":
      return patch(state, { userLocation: action.at });
  }
}

export function mobileSheet(state: ExplorerState): "layers" | "events" | "detail" | null {
  if (state.right === "detail" && state.selection) return "detail";
  if (state.right === "events") return "events";
  return state.left ? "layers" : null;
}

export function inSpatialFilter(filter: SpatialFilter | null, lon: number, lat: number): boolean {
  return !filter || haversineKm(filter.center, [lon, lat]) <= filter.radiusKm;
}
