// Genera public/data/tectonics/{boundaries,plates}.json desde PB2002
// (Bird, 2003; GeoJSON de Hugo Ahlenius, licencia ODC-By 1.0).
// Uso: pnpm build:tectonics  (solo hace falta al actualizar los datos).

import { mkdir, writeFile } from "node:fs/promises";
import { mergeSteps, buildPlates } from "./tectonics-lib.mjs";

const BASE = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON";
const OUT = new URL("../public/data/tectonics/", import.meta.url);

async function get(name) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const [steps, plates] = await Promise.all([get("PB2002_steps.json"), get("PB2002_plates.json")]);
const boundaries = mergeSteps(steps.features.map((f) => f.properties));
const plateCards = buildPlates(plates.features, boundaries);

const attribution = "PB2002 — Bird (2003), doi:10.1029/2001GC000252 · GeoJSON: Ahlenius (ODC-By 1.0)";
await mkdir(OUT, { recursive: true });
await writeFile(new URL("boundaries.json", OUT), JSON.stringify({ type: "FeatureCollection", attribution, features: boundaries }));
await writeFile(new URL("plates.json", OUT), JSON.stringify({ type: "FeatureCollection", attribution, features: plateCards }));
console.log(`límites: ${boundaries.length} · placas: ${plateCards.length}`);
