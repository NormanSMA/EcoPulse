// Regenera el contorno de Nicaragua en src/lib/zones/nicaragua.data.json.
// Fuente: Natural Earth (dominio publico), https://www.naturalearthdata.com
// Uso: node scripts/build-nicaragua-from-ne.mjs [--out <carpeta temporal>]
// El geojson se descarga fuera del repo (por defecto os.tmpdir()).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const MIN = 120;
const MAX = 260;
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "src", "lib", "zones", "nicaragua.data.json");
const outIdx = process.argv.indexOf("--out");
const outDir = path.resolve(outIdx > 0 ? process.argv[outIdx + 1] : path.join(os.tmpdir(), "ecopulse-ne"));

async function fetchRing(file) {
  await mkdir(outDir, { recursive: true });
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(path.join(outDir, file), text);
  const feature = JSON.parse(text).features.find((f) => f.properties.ADM0_A3 === "NIC");
  if (!feature) throw new Error("NIC no encontrada");
  const g = feature.geometry;
  const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const rings = polygons.map((p) => p[0]);
  rings.sort((a, b) => ringArea(b) - ringArea(a));
  return rings[0].slice(0, -1); // anillo exterior mayor, sin el punto de cierre repetido
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(s / 2);
}

function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker sobre una polilinea abierta; devuelve los indices conservados.
function dp(pts, eps) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx >= 0 && max > eps) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Anillo cerrado: se parte en dos mitades por el vertice mas lejano al primero.
function simplifyRing(ring, eps) {
  let far = 0;
  let best = -1;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]);
    if (d > best) { best = d; far = i; }
  });
  const a = dp(ring.slice(0, far + 1), eps);
  const b = dp([...ring.slice(far), ring[0]], eps);
  return [...a, ...b.slice(1, -1)];
}

function fit(ring) {
  let lo = 0;
  let hi = 0.5;
  let res = ring;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const s = simplifyRing(ring, mid);
    if (s.length > MAX) lo = mid;
    else { hi = mid; res = s; }
    if (s.length >= MIN && s.length <= MAX && i > 8) { res = s; break; }
  }
  return res;
}

let ring = await fetchRing("ne_50m_admin_0_countries.geojson");
if (ring.length < MIN) {
  console.log(`50m da ${ring.length} vertices; uso 10m`);
  ring = await fetchRing("ne_10m_admin_0_countries.geojson");
}
let simple = ring.length > MAX ? fit(ring) : ring;
// Evita ceros negativos y duplicados tras redondear.
const round = (v) => Math.round(v * 1e4) / 1e4 + 0;
simple = simple.map(([x, y]) => [round(x), round(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
if (simple.length < MIN || simple.length > MAX) throw new Error(`vertices fuera de rango: ${simple.length}`);
const closed = [...simple, simple[0]];

const xs = closed.map((p) => p[0]);
const ys = closed.map((p) => p[1]);
const bbox = [
  Math.floor(Math.min(...xs) * 10) / 10,
  Math.floor(Math.min(...ys) * 10) / 10,
  Math.ceil(Math.max(...xs) * 10) / 10,
  Math.ceil(Math.max(...ys) * 10) / 10,
];

const old = await readFile(target, "utf8");
const rows = [];
for (let i = 0; i < closed.length; i += 5) rows.push("    " + closed.slice(i, i + 5).map((p) => `[${p[0]}, ${p[1]}]`).join(", "));
// Conserva el bloque de departamentos tal cual esta en el archivo actual.
const departments = old.slice(old.indexOf('  "departments"'));
const text = [
  "{",
  '  "outline": [',
  rows.join(",\n"),
  "  ],",
  `  "bbox": ${JSON.stringify(bbox).replace(/,/g, ", ")},`,
  departments,
].join("\n");
JSON.parse(text);
await writeFile(target, text);
console.log(`Nicaragua: ${closed.length} puntos (${simple.length} vertices), bbox ${bbox}`);
