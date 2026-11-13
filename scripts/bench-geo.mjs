// Benchmark de puntos calientes de CPU de la Fase 2. Uso: node scripts/bench-geo.mjs
// Mide JS puro: nearestBoundary, campo IDW 96x96 con 80 puntos y parseo de CSV FIRMS.
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;

function angular(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function bearing(a, b) {
  const dLon = rad(b[0] - a[0]);
  const l1 = rad(a[1]);
  const l2 = rad(b[1]);
  return Math.atan2(Math.sin(dLon) * Math.cos(l2), Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon));
}
function toSegment(p, s, e) {
  const fromStart = angular(s, p);
  const len = angular(s, e);
  if (len < 1e-12) return fromStart * R;
  const angle = bearing(s, p) - bearing(s, e);
  const along = Math.atan2(Math.sin(fromStart) * Math.cos(angle), Math.cos(fromStart));
  if (along < 0 || along > len) return Math.min(fromStart, angular(e, p)) * R;
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(fromStart) * Math.sin(angle))))) * R;
}

function time(label, runs, fn) {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - t0) / runs;
  console.log(`${label}: ${ms.toFixed(3)} ms/op (${runs} corridas)`);
  return ms;
}

// 1. nearestBoundary sobre boundaries.json real.
const boundaries = JSON.parse(readFileSync(new URL("../public/data/tectonics/boundaries.json", import.meta.url), "utf8"));
let segments = 0;
for (const f of boundaries.features) segments += f.geometry.coordinates.length - 1;
console.log(`boundaries: ${boundaries.features.length} features, ${segments} segmentos`);
time("nearestBoundary", 200, () => {
  const p = [-86.25, 12.13];
  let best = Infinity;
  for (const f of boundaries.features) {
    const c = f.geometry.coordinates;
    for (let i = 0; i < c.length - 1; i++) best = Math.min(best, toSegment(p, c[i], c[i + 1]));
  }
  return best;
});

// 2. Campo IDW: 80 puntos, rejilla 96x96, potencia 2, distancia plana en grados.
const pts = Array.from({ length: 80 }, (_, i) => ({ x: -90 + (i % 10), y: 8 + Math.floor(i / 10), v: Math.sin(i) * 10 }));
function idw(width, height) {
  const out = new Float32Array(width * height);
  for (let r = 0; r < height; r++) {
    const y = 8 + (r / (height - 1)) * 8;
    for (let c = 0; c < width; c++) {
      const x = -90 + (c / (width - 1)) * 9;
      let num = 0;
      let den = 0;
      for (const p of pts) {
        const d2 = (x - p.x) ** 2 + (y - p.y) ** 2 + 1e-9;
        const w = 1 / d2;
        num += w * p.v;
        den += w;
      }
      out[r * width + c] = num / den;
    }
  }
  return out;
}
time("IDW 96x96 x80 (un canal)", 50, () => idw(96, 96));
time("IDW 96x96 x80 (u,v,nubes,lluvia = 4 canales)", 20, () => {
  idw(96, 96);
  idw(96, 96);
  idw(96, 96);
  idw(96, 96);
});

// 3. Parseo de CSV FIRMS sintético: 55 000 filas crudas.
const header = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";
const rows = [header];
for (let i = 0; i < 55000; i++) {
  const conf = i % 26 === 0 ? "h" : i % 2 ? "n" : "l";
  rows.push(`${(Math.random() * 160 - 80).toFixed(5)},${(Math.random() * 360 - 180).toFixed(5)},330.1,0.4,0.4,2026-11-12,1234,N20,VIIRS,${conf},2.0NRT,290.2,${(Math.random() * 40).toFixed(1)},D`);
}
const csv = rows.join("\n");
console.log(`CSV sintético: ${(csv.length / 1e6).toFixed(1)} MB`);
time("parse FIRMS", 10, () => {
  const lines = csv.split("\n");
  const head = lines[0].split(",");
  const iLat = head.indexOf("latitude");
  const iLon = head.indexOf("longitude");
  const iConf = head.indexOf("confidence");
  const iFrp = head.indexOf("frp");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c[iConf] !== "h" || Number(c[iFrp]) < 10) continue;
    out.push([Number(c[iLon]), Number(c[iLat]), Number(c[iFrp])]);
  }
  return out;
});
