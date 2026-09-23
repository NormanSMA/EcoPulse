import type { StyleSpecification } from "maplibre-gl";

export type Basemap = "dark" | "light" | "satellite";

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
  },
  layers: [
    {
      id: "esri-world-imagery-layer",
      type: "raster",
      source: "esri-world-imagery",
    },
  ],
};

export const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
  dark: OPENFREEMAP_DARK_STYLE,
  light: OPENFREEMAP_LIGHT_STYLE,
  satellite: ESRI_SATELLITE_STYLE,
};

// Etiquetas visibles: messages/*.json -> basemap.{dark,light,satellite}.
export const BASEMAP_ORDER: Basemap[] = ["dark", "light", "satellite"];
