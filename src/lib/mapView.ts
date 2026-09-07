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
