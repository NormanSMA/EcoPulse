// Funciones puras para convertir PB2002 (Bird, 2003) en los archivos que sirve
// la web. Las usa scripts/build-tectonics.mjs y se prueban con Vitest.

/** Clase de tramo PB2002 → tipo de límite. */
export const STEP_TYPE = {
  OSR: "divergent", // dorsal oceánica
  CRB: "divergent", // rift continental
  SUB: "convergent", // subducción
  OCB: "convergent", // convergencia oceánica
  CCB: "convergent", // colisión continental
  OTF: "transform", // falla transformante oceánica
  CTF: "transform", // falla transformante continental
};

const round = (v) => Math.round(v * 100) / 100;

/**
 * Une tramos consecutivos del mismo límite y la misma clase en polilíneas.
 * Corta la línea al cruzar el antimeridiano. Velocidad: media ponderada por longitud.
 */
export function mergeSteps(steps) {
  const sorted = [...steps].sort((a, b) => a.SEQNUM - b.SEQNUM);
  const lines = [];
  let cur = null;
  const close = () => {
    if (cur && cur.coords.length >= 2) lines.push(cur);
    cur = null;
  };
  for (const s of sorted) {
    const type = STEP_TYPE[s.STEPCLASS];
    if (!type) continue;
    const start = [round(s.STARTLONG), round(s.STARTLAT)];
    const end = [round(s.FINALLONG), round(s.FINALLAT)];
    const crosses = Math.abs(end[0] - start[0]) > 180;
    const continues =
      cur && cur.plates === s.PLATEBOUND && cur.stepClass === s.STEPCLASS && cur.coords.at(-1)[0] === start[0] && cur.coords.at(-1)[1] === start[1];
    if (!continues || crosses) close();
    if (crosses) continue; // tramo de unos km partido por el antimeridiano: se omite
    if (!cur) cur = { plates: s.PLATEBOUND, stepClass: s.STEPCLASS, type, coords: [start], length: 0, velSum: 0 };
    cur.coords.push(end);
    cur.length += s.STEPLENGTH;
    cur.velSum += s.VELOCITYLE * s.STEPLENGTH;
  }
  close();
  return lines.map((l, i) => ({
    type: "Feature",
    id: i,
    properties: {
      id: `b${i}`,
      plates: l.plates,
      stepClass: l.stepClass,
      type: l.type,
      lengthKm: Math.round(l.length),
      velocityMmYr: l.length ? Math.round((l.velSum / l.length) * 10) / 10 : null,
    },
    geometry: { type: "LineString", coordinates: l.coords },
  }));
}

/** Centroide de un anillo con longitudes "desenrolladas" (válido para placas que cruzan el antimeridiano). */
export function ringCentroid(ring) {
  const ref = ring[0][0];
  let x = 0;
  let y = 0;
  for (const [lon, lat] of ring) {
    let l = lon;
    while (l - ref > 180) l -= 360;
    while (l - ref < -180) l += 360;
    x += l;
    y += lat;
  }
  let lon = x / ring.length;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return [round(lon), round(y / ring.length)];
}

/** Área esférica aproximada de un anillo en km² (fórmula de Chamberlain y Duquette). */
export function ringAreaKm2(ring) {
  const R = 6371;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    let dLon = lon2 - lon1;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    sum += dLon * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * R * R) / 2);
}

/** Fichas de placa: nombre, punto de etiqueta, área y placas vecinas. */
export function buildPlates(plates, boundaries) {
  const neighbors = new Map();
  for (const b of boundaries) {
    const [a, c] = b.properties.plates.split(/[-/\\]/);
    if (!a || !c) continue;
    if (!neighbors.has(a)) neighbors.set(a, new Set());
    if (!neighbors.has(c)) neighbors.set(c, new Set());
    neighbors.get(a).add(c);
    neighbors.get(c).add(a);
  }
  const byCode = new Map();
  for (const f of plates) {
    const code = f.properties.Code;
    const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
    const area = rings.reduce((s, r) => s + ringAreaKm2(r), 0);
    const largest = rings.reduce((m, r) => (r.length > m.length ? r : m), rings[0]);
    const prev = byCode.get(code);
    if (prev) {
      prev.areaKm2 += area;
      continue;
    }
    byCode.set(code, { code, name: f.properties.PlateName, label: ringCentroid(largest), areaKm2: area });
  }
  return [...byCode.values()].map((p) => ({
    type: "Feature",
    properties: { code: p.code, name: p.name, areaKm2: Math.round(p.areaKm2 / 1000) * 1000, neighbors: [...(neighbors.get(p.code) ?? [])].sort() },
    geometry: { type: "Point", coordinates: p.label },
  }));
}
