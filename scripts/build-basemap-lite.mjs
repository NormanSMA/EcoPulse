// Genera public/data/basemap-lite.json: el estilo MapLibre mínimo que se usa
// sin conexión. No depende de teselas: dibuja el contorno de Nicaragua, sus
// 17 cabeceras y los límites de placas (archivo estático que el service
// worker guarda). Ejecutar tras cambiar src/lib/zones/nicaragua.data.json:
//   node scripts/build-basemap-lite.mjs
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/lib/zones/nicaragua.data.json", import.meta.url), "utf8"));

const ring = [...data.outline];
const [firstLon, firstLat] = ring[0];
const [lastLon, lastLat] = ring[ring.length - 1];
if (firstLon !== lastLon || firstLat !== lastLat) ring.push(ring[0]);

const FONT = ["Noto Sans Regular"];
const INK = "#121317";
const LAND = "#1f2229";
const BORDER = "#5f6675";
const LABEL = "#e3e5ea";
const PLATE = "#b085f5";

const style = {
  version: 8,
  name: "EcoPulse offline",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "offline-country": {
      type: "geojson",
      data: { type: "Feature", properties: { name: "Nicaragua" }, geometry: { type: "Polygon", coordinates: [ring] } },
    },
    "offline-capitals": {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: data.departments.map((d) => ({
          type: "Feature",
          properties: { name: d.capital, department: d.name },
          geometry: { type: "Point", coordinates: [d.capitalLon, d.capitalLat] },
        })),
      },
    },
    // Ruta relativa: lib/mapStyles la vuelve absoluta con el origen de la página.
    "offline-plates": { type: "geojson", data: "/data/tectonics/boundaries.json" },
  },
  layers: [
    { id: "offline-background", type: "background", paint: { "background-color": INK } },
    { id: "offline-country-fill", type: "fill", source: "offline-country", paint: { "fill-color": LAND } },
    { id: "offline-country-line", type: "line", source: "offline-country", paint: { "line-color": BORDER, "line-width": 1.5 } },
    {
      id: "offline-plates",
      type: "line",
      source: "offline-plates",
      paint: { "line-color": PLATE, "line-width": 1, "line-opacity": 0.6, "line-dasharray": [3, 2] },
    },
    {
      id: "offline-capitals",
      type: "circle",
      source: "offline-capitals",
      paint: { "circle-radius": 3.5, "circle-color": LABEL, "circle-stroke-color": INK, "circle-stroke-width": 1.5 },
    },
    {
      id: "offline-capitals-label",
      type: "symbol",
      source: "offline-capitals",
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 13],
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: { "text-color": LABEL, "text-halo-color": INK, "text-halo-width": 1.5 },
    },
  ],
};

const out = new URL("../public/data/basemap-lite.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(style)}\n`);
console.log(`basemap-lite.json: ${ring.length} vértices, ${data.departments.length} cabeceras`);
