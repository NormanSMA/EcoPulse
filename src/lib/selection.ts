// Selección única para el mapa 2D y el globo 3D: ambos emiten este objeto al
// hacer click y la página lo resuelve contra los mismos datos, así el panel
// de detalle muestra exactamente la misma información en las dos vistas.

export type Selection =
  | { kind: "quake"; id: string }
  | { kind: "fire"; id: string }
  | { kind: "disaster"; id: string }
  | { kind: "cyclone"; id: string }
  | { kind: "volcano"; id: number }
  | { kind: "volcanoCatalog"; id: number }
  | { kind: "air"; id: number }
  | { kind: "iss" }
  // name/detail: lugar elegido en el buscador (si no, se geocodifica el punto).
  | { kind: "point"; lon: number; lat: number; name?: string; detail?: string };

export type SelectionKind = Selection["kind"];

export function selectionKey(s: Selection | null): string {
  if (!s) return "";
  if (s.kind === "iss") return "iss";
  if (s.kind === "point") return `point:${s.lon.toFixed(4)},${s.lat.toFixed(4)}`;
  return `${s.kind}:${s.id}`;
}

// Prefijos de id de entidad en Cesium (y de feature en MapLibre) por tipo.
const PREFIX: Record<Exclude<SelectionKind, "iss" | "point">, string> = {
  quake: "eq-",
  fire: "fire-",
  disaster: "disaster-",
  cyclone: "cyc-pos-",
  volcano: "vol-",
  volcanoCatalog: "volcat-",
  air: "aq-",
};

export function entityIdFor(s: Selection): string | null {
  if (s.kind === "iss") return "iss";
  if (s.kind === "point") return null;
  return `${PREFIX[s.kind]}${s.id}`;
}

/** Inverso de entityIdFor: id de entidad/primitiva → selección. */
export function selectionFromEntityId(id: string): Selection | null {
  if (id === "iss") return { kind: "iss" };
  for (const [kind, prefix] of Object.entries(PREFIX) as [keyof typeof PREFIX, string][]) {
    if (!id.startsWith(prefix)) continue;
    const raw = id.slice(prefix.length);
    if (kind === "volcano" || kind === "volcanoCatalog" || kind === "air") {
      const n = Number(raw);
      return Number.isFinite(n) ? ({ kind, id: n } as Selection) : null;
    }
    return { kind, id: raw } as Selection;
  }
  return null;
}
