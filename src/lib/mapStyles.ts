import type { StyleSpecification } from "maplibre-gl";
import basemapLite from "../../public/data/basemap-lite.json";

/** "offline" no se elige a mano: lo activa la app cuando no hay conexión. */
export type Basemap = "dark" | "light" | "satellite" | "offline";
export type SelectableBasemap = Exclude<Basemap, "offline">;

// Tipografía de las etiquetas del mapa y rangos de glifos que el service
// worker guarda para que el estilo sin conexión muestre nombres.
export const MAP_FONT = "Noto Sans Regular";
export const OFFLINE_ASSET_URLS = [
  `https://tiles.openfreemap.org/fonts/${encodeURIComponent(MAP_FONT)}/0-255.pbf`,
  `https://tiles.openfreemap.org/fonts/${encodeURIComponent(MAP_FONT)}/256-511.pbf`,
  "/data/tectonics/boundaries.json",
  "/data/tectonics/plates.json",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

/**
 * Estilo sin teselas (public/data/basemap-lite.json): contorno de Nicaragua,
 * sus 17 cabeceras y los límites de placas. Las rutas relativas de sus
 * fuentes se resuelven contra el origen de la página.
 */
function offlineStyle(): StyleSpecification {
  const style = structuredClone(basemapLite) as unknown as StyleSpecification;
  if (typeof location === "undefined") return style;
  for (const source of Object.values(style.sources)) {
    if (source.type === "geojson" && typeof source.data === "string" && source.data.startsWith("/")) {
      source.data = new URL(source.data, location.origin).href;
    }
  }
  return style;
}

// OpenFreeMap sirve, entre otros, "dark" y "liberty" (su estilo claro tipo
// "positron"/OSM Bright por defecto) - https://openfreemap.org/quick_start/
const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";
const OPENFREEMAP_LIGHT_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// No hay API key de MapTiler/Mapbox configurada (ver .env.example), así que
// el basemap satelital usa ESRI World Imagery vía XYZ raster, que no
// requiere key. Se construye como StyleSpecification propio de MapLibre.
const ESRI_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  // Sin glyphs, las capas de texto (temperaturas, ISS, ciclones, conteo de
  // clusters) fallaban en silencio sobre el mapa satelital.
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
    // Etiquetas de lugares y límites (raster transparente del mismo proveedor):
    // sin esta capa la imagen satelital no muestra nombres.
    "esri-reference-places": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri",
    },
  },
  layers: [
    {
      id: "esri-world-imagery-layer",
      type: "raster",
      source: "esri-world-imagery",
    },
    {
      id: "esri-reference-places-layer",
      type: "raster",
      source: "esri-reference-places",
    },
  ],
};

export const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
  dark: OPENFREEMAP_DARK_STYLE,
  light: OPENFREEMAP_LIGHT_STYLE,
  satellite: ESRI_SATELLITE_STYLE,
  offline: offlineStyle(),
};

// Etiquetas visibles: messages/*.json -> basemap.{dark,light,satellite}.
export const BASEMAP_ORDER: SelectableBasemap[] = ["dark", "light", "satellite"];
