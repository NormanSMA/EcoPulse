// Interpreta el cuadro de busqueda unico: lugar, coordenadas o "aqui", con radio opcional.

export type OmniQuery =
  | { kind: "empty" }
  | { kind: "place"; text: string; radiusKm?: number }
  | { kind: "coords"; lat: number; lon: number; radiusKm?: number }
  | { kind: "here"; radiusKm: number };

export const RADIUS_LIMITS = { min: 1, max: 2000 } as const;

const NUM = String.raw`[+-]?\d+(?:[.,]\d+)?`;
const COORDS = new RegExp(String.raw`^(${NUM})\s*([NS])?(?:\s*[,;]\s*|\s+)(${NUM})\s*([EW])?$`, "i");

const toNumber = (s: string) => Number(s.replace(",", "."));

function parseRadius(raw: string): number | undefined {
  const value = raw.replace(/\s*km\s*$/i, "").trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) return undefined;
  const km = toNumber(value);
  return km >= RADIUS_LIMITS.min && km <= RADIUS_LIMITS.max ? km : undefined;
}

export function parseOmniQuery(input: string): OmniQuery {
  const at = input.lastIndexOf("@");
  const text = (at >= 0 ? input.slice(0, at) : input).trim();
  const radiusKm = at >= 0 ? parseRadius(input.slice(at + 1).trim()) : undefined;
  const radius = radiusKm === undefined ? {} : { radiusKm };

  if (!text) return radiusKm === undefined ? { kind: "empty" } : { kind: "here", radiusKm };

  const m = COORDS.exec(text);
  if (m) {
    let lat = toNumber(m[1]);
    let lon = toNumber(m[3]);
    if (m[2]) lat = (m[2].toUpperCase() === "S" ? -1 : 1) * Math.abs(lat);
    if (m[4]) lon = (m[4].toUpperCase() === "W" ? -1 : 1) * Math.abs(lon);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { kind: "coords", lat, lon, ...radius };
  }
  return { kind: "place", text, ...radius };
}
