export interface MapView {
  lng: number;
  lat: number;
  zoom: number;
}

// Managua / Centroamérica: vista inicial del mapa único (MapLibre, proyección
// mercator o globe). Vive en su propio módulo, sin maplibre-gl, para que
// page.tsx pueda importarlo sin forzar esa dependencia pesada al bundle
// principal: MapContainer se carga con next/dynamic + ssr:false.
export const DEFAULT_MAP_VIEW: MapView = { lng: -86.2362, lat: 12.115, zoom: 3.5 };
