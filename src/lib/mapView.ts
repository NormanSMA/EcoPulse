export interface MapView {
  lng: number;
  lat: number;
  zoom: number;
}

// Managua / Centroamérica — vista inicial compartida entre MapContainer
// (MapLibre 2D) y GlobeContainer (Cesium 3D) para preservar la ubicación al
// alternar de modo. Vive en su propio módulo (sin maplibre-gl/cesium) para
// que page.tsx pueda importarlo sin forzar esas dependencias pesadas al
// bundle principal — ambos contenedores de mapa siguen cargándose con
// next/dynamic + ssr:false.
export const DEFAULT_MAP_VIEW: MapView = { lng: -86.2362, lat: 12.115, zoom: 3.5 };

// Equivalencia zoom 2D ↔ altitud de cámara 3D: se busca que el ancho visible
// del mapa (MapLibre, teselas de 512 px) sea el mismo en el globo (Cesium,
// FOV de 60° sobre el lado mayor del lienzo). Es una aproximación plana,
// suficiente para que al alternar de modo se vea la misma región.
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const TAN_HALF_FOV = Math.tan(Math.PI / 6);
const MAX_ALTITUDE_M = 2.5e7;

function metersPerPixelFactor(lat: number): number {
  // Se acota cerca de los polos, donde cos(lat) → 0.
  return (EARTH_CIRCUMFERENCE_M * Math.max(Math.cos((lat * Math.PI) / 180), 0.1)) / 512;
}

function tanHalfWidthFov(width: number, height: number): number {
  return width >= height ? TAN_HALF_FOV : (TAN_HALF_FOV * width) / height;
}

export function zoomToAltitude(lat: number, zoom: number, width: number, height: number): number {
  const visibleWidth = (metersPerPixelFactor(lat) / 2 ** zoom) * width;
  return Math.min(MAX_ALTITUDE_M, visibleWidth / (2 * tanHalfWidthFov(width, height)));
}

export function altitudeToZoom(lat: number, altitude: number, width: number, height: number): number {
  const metersPerPixel = (altitude * 2 * tanHalfWidthFov(width, height)) / width;
  return Math.min(22, Math.max(0, Math.log2(metersPerPixelFactor(lat) / metersPerPixel)));
}
