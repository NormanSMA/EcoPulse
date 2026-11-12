import { describe, expect, it } from "vitest";
import { explorerReducer, inSpatialFilter, initialExplorerState, mobileSheet, type ExplorerState } from "./explorerState";
import type { Selection } from "./selection";

const quake: Selection = { kind: "quake", id: "q1" };
const base = (over: Partial<ExplorerState> = {}): ExplorerState => ({ ...initialExplorerState("wide"), ...over });

describe("initialExplorerState", () => {
  it("abre paneles segun el layout", () => {
    expect(initialExplorerState("wide")).toMatchObject({ left: true, right: "events" });
    expect(initialExplorerState("medium")).toMatchObject({ left: false, right: "events" });
    expect(initialExplorerState("mobile")).toMatchObject({ left: false, right: null });
  });
});

describe("select", () => {
  it("fija seleccion, detalle y foco con fly", () => {
    const s = explorerReducer(base(), { type: "select", selection: quake, fly: [-86, 12], layout: "wide", now: 5 });
    expect(s).toMatchObject({ selection: quake, right: "detail", left: true, focus: { lng: -86, lat: 12, key: 5 } });
  });
  it("sin fly conserva el foco", () => {
    const focus = { lng: 1, lat: 2, key: 3 };
    const s = explorerReducer(base({ focus }), { type: "select", selection: quake, layout: "wide", now: 9 });
    expect(s.focus).toBe(focus);
  });
  it("cierra el panel izquierdo en medium y mobile", () => {
    for (const layout of ["medium", "mobile"] as const) {
      const s = explorerReducer(base({ left: true }), { type: "select", selection: quake, layout, now: 1 });
      expect(s.left).toBe(false);
    }
  });
});

describe("clearSelection", () => {
  it("vuelve a eventos en medium/wide y cierra en mobile", () => {
    const sel = base({ selection: quake, right: "detail" });
    expect(explorerReducer(sel, { type: "clearSelection", layout: "wide" })).toMatchObject({ selection: null, right: "events" });
    expect(explorerReducer(sel, { type: "clearSelection", layout: "medium" }).right).toBe("events");
    expect(explorerReducer(sel, { type: "clearSelection", layout: "mobile" })).toMatchObject({ selection: null, right: null });
  });
});

describe("openLeft", () => {
  it("abre capas; en wide conserva derecha", () => {
    expect(explorerReducer(base({ left: false }), { type: "openLeft", layout: "wide" })).toMatchObject({ left: true, right: "events" });
  });
  it("en medium y mobile cierra derecha sin borrar seleccion", () => {
    const s = base({ left: false, selection: quake, right: "detail" });
    for (const layout of ["medium", "mobile"] as const) {
      expect(explorerReducer(s, { type: "openLeft", layout })).toMatchObject({ left: true, right: null, selection: quake });
    }
  });
});

describe("openRight", () => {
  it("abre detalle con seleccion y eventos sin ella", () => {
    expect(explorerReducer(base({ right: null }), { type: "openRight", layout: "wide" }).right).toBe("events");
    expect(explorerReducer(base({ right: null, selection: quake }), { type: "openRight", layout: "wide" }).right).toBe("detail");
  });
  it("cierra izquierda en medium y mobile, no en wide", () => {
    expect(explorerReducer(base({ right: null }), { type: "openRight", layout: "medium" }).left).toBe(false);
    expect(explorerReducer(base({ right: null }), { type: "openRight", layout: "wide" }).left).toBe(true);
  });
});

describe("closeRight", () => {
  it("en mobile cierra el detalle y borra la seleccion", () => {
    const s = base({ selection: quake, right: "detail" });
    expect(explorerReducer(s, { type: "closeRight", layout: "mobile" })).toMatchObject({ right: null, selection: null });
  });
  it("en mobile con eventos no toca la seleccion", () => {
    const s = base({ selection: quake, right: "events" });
    expect(explorerReducer(s, { type: "closeRight", layout: "mobile" }).selection).toBe(quake);
  });
  it("en medium/wide conserva la seleccion", () => {
    const s = base({ selection: quake, right: "detail" });
    expect(explorerReducer(s, { type: "closeRight", layout: "wide" })).toMatchObject({ right: null, selection: quake });
    expect(explorerReducer(s, { type: "closeRight", layout: "medium" }).selection).toBe(quake);
  });
});

describe("layout", () => {
  it("mobile: cierra izquierda y derecha segun seleccion", () => {
    expect(explorerReducer(base(), { type: "layout", layout: "mobile" })).toMatchObject({ left: false, right: null });
    expect(explorerReducer(base({ selection: quake }), { type: "layout", layout: "mobile" }).right).toBe("detail");
  });
  it("medium: cierra izquierda si ambos paneles estan abiertos", () => {
    expect(explorerReducer(base(), { type: "layout", layout: "medium" })).toMatchObject({ left: false, right: "events" });
  });
  it("wide: sin cambios", () => {
    const s = base();
    expect(explorerReducer(s, { type: "layout", layout: "wide" })).toBe(s);
  });
  it("medium/wide con derecha cerrada y seleccion abre detalle", () => {
    const s = base({ selection: quake, right: null, left: false });
    expect(explorerReducer(s, { type: "layout", layout: "medium" }).right).toBe("detail");
    expect(explorerReducer(s, { type: "layout", layout: "wide" }).right).toBe("detail");
  });
});

describe("asignaciones directas", () => {
  it("focus, clearFocus, setFilter y located", () => {
    let s = explorerReducer(base(), { type: "focus", at: [1, 2], now: 7 });
    expect(s.focus).toEqual({ lng: 1, lat: 2, key: 7 });
    s = explorerReducer(s, { type: "clearFocus" });
    expect(s.focus).toBeNull();
    const filter = { center: [0, 0] as [number, number], radiusKm: 10 };
    s = explorerReducer(s, { type: "setFilter", filter });
    expect(s.spatialFilter).toBe(filter);
    s = explorerReducer(s, { type: "located", at: [3, 4] });
    expect(s.userLocation).toEqual([3, 4]);
    s = explorerReducer(s, { type: "closeLeft" });
    expect(s.left).toBe(false);
  });
});

describe("mismo objeto sin cambios", () => {
  it("devuelve el estado original", () => {
    const s = base();
    expect(explorerReducer(s, { type: "clearFocus" })).toBe(s);
    expect(explorerReducer(s, { type: "setFilter", filter: null })).toBe(s);
    expect(explorerReducer(s, { type: "openLeft", layout: "wide" })).toBe(s);
    expect(explorerReducer(s, { type: "clearSelection", layout: "wide" })).toBe(s);
  });
});

describe("mobileSheet", () => {
  it("prioriza detalle, eventos y capas", () => {
    expect(mobileSheet(base({ right: "detail", selection: quake }))).toBe("detail");
    expect(mobileSheet(base({ right: "detail", selection: null, left: true }))).toBe("layers");
    expect(mobileSheet(base({ right: "events", left: true }))).toBe("events");
    expect(mobileSheet(base({ right: null, left: true }))).toBe("layers");
    expect(mobileSheet(base({ right: null, left: false }))).toBeNull();
  });
});

describe("inSpatialFilter", () => {
  it("acepta todo sin filtro y respeta el radio", () => {
    expect(inSpatialFilter(null, 10, 10)).toBe(true);
    const f = { center: [-86.23, 12.11] as [number, number], radiusKm: 50 };
    expect(inSpatialFilter(f, -86.2, 12.1)).toBe(true);
    expect(inSpatialFilter(f, -80, 12.1)).toBe(false);
  });
});
