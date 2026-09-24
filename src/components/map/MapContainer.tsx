'use client';

import React, { useEffect, useRef } from "react";
import maplibregl, {
  GeoJSONSource,
  Map as MapLibreMap,
  type ExpressionSpecification,
  type FilterSpecification,
  type MapGeoJSONFeature,
  type RasterTileSource,
} from "maplibre-gl";
import type { EarthquakeGeoJSON, FireGeoJSON, IssGeoJSON, AirQualityGeoJSON } from "@/lib/types";
import { DEFAULT_MAP_VIEW } from "@/lib/mapView";
import { BASEMAP_STYLES, type Basemap } from "@/lib/mapStyles";
import { layers, scales, marker, withAlpha, type LayerKey } from "@/design-system/tokens";
import { registerMapIcons } from "@/lib/mapIcons";
import { nightPolygon, footprintRing, unwrapLongitudes } from "@/lib/geoShapes";
import type { Selection } from "@/lib/selection";
import type { MapViewProps } from "./types";

interface MapContainerProps extends MapViewProps {
  basemap: Basemap;
}

// Capas de MapLibre que controla cada toggle del panel.
const LAYER_GROUPS: Record<LayerKey, string[]> = {
  dayNight: ["night-fill"],
  radar: ["radar"],
  earthquakes: ["quake-clusters", "quake-cluster-count", "quakes", "quake-pulse"],
  airQuality: ["air-quality"],
  fires: ["fires-heat", "fires"],
  disasters: ["disasters"],
  volcanoes: ["volcanoes"],
  volcanoCatalog: ["volcano-catalog"],
  cyclones: ["cyclone-cone", "cyclone-cone-line", "cyclone-track", "cyclone-forecast", "cyclone-position"],
  iss: ["iss-footprint", "iss-footprint-line", "iss-track-past", "iss-track-future", "iss"],
};

// Orden de prioridad al hacer click (lo que está encima gana).
// Margen de búsqueda alrededor de un toque o click que no cae justo en un elemento.
const TOUCH_HIT_PX = 14;
const MOUSE_HIT_PX = 4;
const INTERACTIVE = ["iss", "cyclone-position", "disasters", "volcanoes", "quakes", "quake-clusters", "fires", "volcano-catalog", "air-quality"];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT_BOLD = ["Noto Sans Bold"];
const NOT_CLUSTER: FilterSpecification = ["!", ["has", "point_count"]];
const HOUR_MS = 3_600_000;
const PULSE_WINDOW_MS = HOUR_MS;
const RADAR_MAX_ZOOM = 7;

const MAG = ["coalesce", ["get", "mag"], 1] as ExpressionSpecification;
const MAG_COLOR = ["interpolate", ["linear"], MAG, ...scales.magnitude.flatMap((s) => [s.stop, s.color])] as ExpressionSpecification;
const MAG_RADIUS = ["interpolate", ["linear"], MAG, 2, 4, 5, 9, 7, 18, 9, 32] as ExpressionSpecification;
const STORM_COLOR = ["match", ["get", "category"], ...scales.storm.flatMap((s) => [s.key, s.color]), scales.storm[1].color] as unknown as ExpressionSpecification;
const AQI_COLOR = [
  "match",
  ["get", "category"],
  "good", scales.aqi.good,
  "moderate", scales.aqi.moderate,
  "unhealthy", scales.aqi.unhealthy,
  "hazardous", scales.aqi.hazardous,
  scales.aqi.unknown,
] as ExpressionSpecification;

/** Opacidad por antigüedad: lo reciente se ve pleno y lo viejo se desvanece. */
function ageOpacity(refTime: number, timeProp: string): ExpressionSpecification {
  const ageHours = ["/", ["-", refTime, ["get", timeProp]], HOUR_MS] as ExpressionSpecification;
  return ["interpolate", ["linear"], ageHours, 0, 0.95, 6, 0.8, 24, 0.5, 72, 0.3] as ExpressionSpecification;
}

/** Los iconos de incendio aparecen al acercarse (zoom va en el nivel superior). */
function fireOpacity(refTime: number): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 5.5, 0, 7, ageOpacity(refTime, "_t")] as ExpressionSpecification;
}

// ---------- Transformaciones de datos para las fuentes ----------
// MapLibre descarta los ids de feature que no son numéricos, así que el id
// que necesita la selección se copia a properties._id.
function withIds<T extends { features: { id: string | number; properties: object }[] }>(fc: T, extra?: (f: T["features"][number]) => object) {
  return {
    ...fc,
    features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, _id: String(f.id), ...(extra?.(f) ?? {}) } })),
  } as unknown as GeoJSON.FeatureCollection;
}
const quakeData = (fc: EarthquakeGeoJSON) => withIds(fc);
const fireData = (fc: FireGeoJSON) => withIds(fc, (f) => ({ _t: Date.parse((f as FireGeoJSON["features"][number]).properties.acquiredAt) }));
const airData = (fc: AirQualityGeoJSON) => withIds(fc);

// Trayectoria real (pasada + futura) y huella de visibilidad de la ISS.
function issDerived(iss: IssGeoJSON): { track: GeoJSON.FeatureCollection; footprint: GeoJSON.FeatureCollection } {
  const f = iss.features[0];
  if (!f?.properties.track) return { track: EMPTY, footprint: EMPTY };
  const { past, future } = f.properties.track;
  const [lon, lat] = f.geometry.coordinates;
  const joined = unwrapLongitudes([...past, ...future.slice(1)].map(([x, y]) => [x, y] as [number, number]));
  const anchorIdx = Math.max(0, past.length - 1);
  const shift = joined[anchorIdx] ? Math.round((lon - joined[anchorIdx][0]) / 360) * 360 : 0;
  const line = joined.map(([x, y]) => [x + shift, y]);
  return {
    track: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { kind: "past" }, geometry: { type: "LineString", coordinates: line.slice(0, anchorIdx + 1) } },
        { type: "Feature", properties: { kind: "future" }, geometry: { type: "LineString", coordinates: line.slice(anchorIdx) } },
      ],
    },
    footprint: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [footprintRing(lon, lat, f.properties.altitudeKm)] } }],
    },
  };
}

const nightData = (refTime: number): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [nightPolygon(new Date(refTime))] } }],
});

const selectionData = (p: [number, number] | null): GeoJSON.FeatureCollection =>
  p ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }] } : EMPTY;

/** Feature clicada → selección (misma estructura que emite el globo 3D). */
function toSelection(layerId: string, f: MapGeoJSONFeature): Selection | null {
  const id = (f.properties as { _id?: string })._id;
  switch (layerId) {
    case "iss":
      return { kind: "iss" };
    case "quakes":
      return id ? { kind: "quake", id } : null;
    case "fires":
      return id ? { kind: "fire", id } : null;
    case "disasters":
      return { kind: "disaster", id: String(f.properties.eventId) };
    case "cyclone-position":
      return { kind: "cyclone", id: String(f.properties.eventId) };
    case "volcanoes":
      return id ? { kind: "volcano", id: Number(id) } : null;
    case "volcano-catalog":
      return id ? { kind: "volcanoCatalog", id: Number(id) } : null;
    case "air-quality":
      return id ? { kind: "air", id: Number(id) } : null;
    default:
      return null;
  }
}

export default function MapContainer(props: MapContainerProps) {
  const { data, visibility, refTime, radarTiles, selectedPoint, focus, basemap, initialView = DEFAULT_MAP_VIEW } = props;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  // Props más recientes: setupLayers() corre en el "load" inicial y tras cada
  // map.setStyle() (que borra fuentes y capas); los handlers se registran una vez.
  const propsRef = useRef(props);
  propsRef.current = props;

  function addRadar(map: MapLibreMap, tiles: string) {
    map.addSource("radar", { type: "raster", tiles: [tiles], tileSize: 256, maxzoom: RADAR_MAX_ZOOM, attribution: "RainViewer" });
    map.addLayer(
      {
        id: "radar",
        type: "raster",
        source: "radar",
        layout: { visibility: propsRef.current.visibility.radar ? "visible" : "none" },
        paint: { "raster-opacity": 0.7, "raster-fade-duration": 0 },
      },
      "night-fill"
    );
  }

  function setupLayers(map: MapLibreMap) {
    const p = propsRef.current;
    const vis = (key: LayerKey) => (p.visibility[key] ? "visible" : "none") as "visible" | "none";
    const onLight = p.basemap === "light";
    const labelHalo = onLight ? marker.haloOnLight : marker.halo;
    const labelText = onLight ? marker.labelTextOnLight : marker.labelText;
    const { track, footprint } = issDerived(p.data.iss);

    registerMapIcons(map);

    map.addSource("night", { type: "geojson", data: nightData(p.refTime) });
    map.addSource("quakes", {
      type: "geojson",
      data: quakeData(p.data.earthquakes),
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: 4,
      clusterProperties: { maxMag: ["max", ["coalesce", ["get", "mag"], 0]] },
    });
    map.addSource("air-quality", { type: "geojson", data: airData(p.data.airQuality) });
    map.addSource("fires", { type: "geojson", data: fireData(p.data.fires) });
    map.addSource("disasters", { type: "geojson", data: p.data.disasters });
    map.addSource("volcanoes", { type: "geojson", data: withIds(p.data.volcanoes) });
    map.addSource("volcano-catalog", { type: "geojson", data: p.data.volcanoCatalog ? withIds(p.data.volcanoCatalog) : EMPTY });
    map.addSource("cyclones", { type: "geojson", data: p.data.cyclones });
    map.addSource("iss", { type: "geojson", data: p.data.iss });
    map.addSource("iss-track", { type: "geojson", data: track });
    map.addSource("iss-footprint", { type: "geojson", data: footprint });
    map.addSource("selection", { type: "geojson", data: selectionData(p.selectedPoint) });

    // ---------- Capas (de abajo hacia arriba) ----------
    map.addLayer({
      id: "night-fill",
      type: "fill",
      source: "night",
      layout: { visibility: vis("dayNight") },
      paint: { "fill-color": marker.night, "fill-opacity": onLight ? 0.16 : 0.32, "fill-antialias": false },
    });
    if (p.radarTiles) addRadar(map, p.radarTiles);

    map.addLayer({
      id: "iss-footprint",
      type: "fill",
      source: "iss-footprint",
      layout: { visibility: vis("iss") },
      paint: { "fill-color": marker.issStroke, "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "iss-footprint-line",
      type: "line",
      source: "iss-footprint",
      layout: { visibility: vis("iss") },
      paint: { "line-color": marker.issStroke, "line-opacity": 0.5, "line-width": 1, "line-dasharray": [2, 2] },
    });

    map.addLayer({
      id: "cyclone-cone",
      type: "fill",
      source: "cyclones",
      filter: ["==", ["get", "kind"], "cone"],
      layout: { visibility: vis("cyclones") },
      paint: { "fill-color": marker.cone, "fill-opacity": onLight ? 0.18 : 0.1 },
    });
    map.addLayer({
      id: "cyclone-cone-line",
      type: "line",
      source: "cyclones",
      filter: ["==", ["get", "kind"], "cone"],
      layout: { visibility: vis("cyclones") },
      paint: { "line-color": onLight ? marker.labelTextOnLight : marker.cone, "line-opacity": 0.45, "line-width": 1, "line-dasharray": [3, 2] },
    });
    map.addLayer({
      id: "cyclone-track",
      type: "line",
      source: "cyclones",
      filter: ["all", ["==", ["get", "kind"], "track"], ["!=", ["get", "forecast"], true]],
      layout: { visibility: vis("cyclones"), "line-cap": "round" },
      paint: { "line-color": STORM_COLOR, "line-width": 3.5 },
    });
    map.addLayer({
      id: "cyclone-forecast",
      type: "line",
      source: "cyclones",
      filter: ["all", ["==", ["get", "kind"], "track"], ["==", ["get", "forecast"], true]],
      layout: { visibility: vis("cyclones") },
      paint: { "line-color": STORM_COLOR, "line-width": 2.5, "line-dasharray": [1.5, 1.5] },
    });

    map.addLayer({
      id: "fires-heat",
      type: "heatmap",
      source: "fires",
      maxzoom: 7,
      layout: { visibility: vis("fires") },
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 5], 0, 0.15, 50, 0.6, 200, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 1.6],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 3, 3, 8, 6, 18],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.15, withAlpha(scales.magnitude[0].color, 0.35),
          0.4, withAlpha(layers.fires, 0.75),
          0.75, withAlpha(scales.magnitude[2].color, 0.9),
          1, marker.fireStroke,
        ],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.9, 7, 0],
      },
    });

    map.addLayer({
      id: "air-quality",
      type: "circle",
      source: "air-quality",
      layout: { visibility: vis("airQuality") },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 5, 4.5, 9, 8],
        "circle-color": AQI_COLOR,
        "circle-opacity": 0.9,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0.3, 6, 1],
        "circle-stroke-color": marker.strokeDark,
      },
    });

    map.addLayer({
      id: "volcano-catalog",
      type: "symbol",
      source: "volcano-catalog",
      layout: {
        visibility: vis("volcanoCatalog"),
        "icon-image": "ep-volcano",
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 6, 1],
      },
    });

    map.addLayer({
      id: "fires",
      type: "symbol",
      source: "fires",
      minzoom: 5.5,
      layout: {
        visibility: vis("fires"),
        "icon-image": "ep-fire",
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 5], 0, 0.7, 100, 1.1, 500, 1.5],
      },
      paint: { "icon-opacity": fireOpacity(p.refTime) },
    });

    map.addLayer({
      id: "quake-clusters",
      type: "circle",
      source: "quakes",
      filter: ["has", "point_count"],
      layout: { visibility: vis("earthquakes") },
      paint: {
        "circle-color": ["interpolate", ["linear"], ["get", "maxMag"], ...scales.magnitude.flatMap((s) => [s.stop, s.color])] as ExpressionSpecification,
        "circle-radius": ["step", ["get", "point_count"], 13, 10, 17, 50, 23],
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": marker.stroke,
        "circle-stroke-opacity": 0.85,
      },
    });
    map.addLayer({
      id: "quake-cluster-count",
      type: "symbol",
      source: "quakes",
      filter: ["has", "point_count"],
      layout: {
        visibility: vis("earthquakes"),
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": FONT_BOLD,
        "text-size": 12,
        "text-allow-overlap": true,
      },
      paint: { "text-color": marker.strokeDark },
    });
    map.addLayer({
      id: "quakes",
      type: "circle",
      source: "quakes",
      filter: NOT_CLUSTER,
      layout: { visibility: vis("earthquakes") },
      paint: {
        "circle-radius": MAG_RADIUS,
        "circle-color": MAG_COLOR,
        "circle-opacity": ageOpacity(p.refTime, "time"),
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.stroke,
        "circle-stroke-opacity": ageOpacity(p.refTime, "time"),
      },
    });
    map.addLayer({
      id: "quake-pulse",
      type: "circle",
      source: "quakes",
      filter: ["all", NOT_CLUSTER, ["<", ["-", p.refTime, ["get", "time"]], PULSE_WINDOW_MS]] as FilterSpecification,
      layout: { visibility: vis("earthquakes") },
      paint: {
        "circle-radius": MAG_RADIUS,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": MAG_COLOR,
        "circle-stroke-opacity": 0,
      },
    });

    map.addLayer({
      id: "volcanoes",
      type: "symbol",
      source: "volcanoes",
      layout: {
        visibility: vis("volcanoes"),
        "icon-image": ["match", ["get", "status"], "new", "ep-volcano-new", "ep-volcano-continuing"],
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.75, 5, 1],
      },
    });
    map.addLayer({
      id: "disasters",
      type: "symbol",
      source: "disasters",
      layout: {
        visibility: vis("disasters"),
        "icon-image": ["concat", "ep-disaster-", ["get", "eventType"], "-", ["get", "alertLevel"]],
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.75, 5, 1],
      },
    });
    map.addLayer({
      id: "cyclone-position",
      type: "symbol",
      source: "cyclones",
      filter: ["==", ["get", "kind"], "position"],
      layout: {
        visibility: vis("cyclones"),
        "icon-image": ["concat", "ep-cyclone-", ["coalesce", ["get", "category"], "TS"]],
        "icon-allow-overlap": true,
        "text-field": ["get", "name"],
        "text-font": FONT_BOLD,
        "text-size": 12,
        "text-offset": [0, 1.9],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: { "text-color": labelText, "text-halo-color": labelHalo, "text-halo-width": 2 },
    });

    map.addLayer({
      id: "iss-track-past",
      type: "line",
      source: "iss-track",
      filter: ["==", ["get", "kind"], "past"],
      layout: { visibility: vis("iss"), "line-cap": "round" },
      paint: { "line-color": marker.issStroke, "line-width": 2, "line-opacity": 0.85 },
    });
    map.addLayer({
      id: "iss-track-future",
      type: "line",
      source: "iss-track",
      filter: ["==", ["get", "kind"], "future"],
      layout: { visibility: vis("iss") },
      paint: { "line-color": marker.issStroke, "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [2, 2] },
    });
    map.addLayer({
      id: "iss",
      type: "symbol",
      source: "iss",
      layout: {
        visibility: vis("iss"),
        "icon-image": "ep-iss",
        "icon-allow-overlap": true,
        "text-field": "ISS",
        "text-font": FONT_BOLD,
        "text-size": 12,
        "text-offset": [0, 1.9],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: { "text-color": labelText, "text-halo-color": labelHalo, "text-halo-width": 2 },
    });

    // Anillo de selección (cualquier tipo de elemento o punto del mapa).
    map.addLayer({
      id: "selection-halo",
      type: "circle",
      source: "selection",
      paint: { "circle-radius": 22, "circle-color": withAlpha(marker.selected, 0.15), "circle-stroke-width": 0 },
    });
    map.addLayer({
      id: "selection",
      type: "circle",
      source: "selection",
      paint: { "circle-radius": 17, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": marker.selected },
    });
  }

  // 1. Inicialización única del mapa.
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [initialView.lng, initialView.lat],
      zoom: initialView.zoom,
      pitch: 0,
      // preserveDrawingBuffer evita que el snapshot para backdrop-filter de
      // los paneles flotantes salga en negro sobre el canvas WebGL.
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
      maxPitch: 60,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("styleimagemissing", (e) => {
      if (e.id.startsWith("ep-")) registerMapIcons(map);
      // Iconos que el estilo base pide y su sprite no trae (p.ej. "circle-11"):
      // uno transparente evita el aviso en cada repintado.
      else if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      propsRef.current.onViewChange?.({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
    });
    map.on("load", () => {
      isMapLoadedRef.current = true;
      setupLayers(map);
    });

    // Un solo handler de click: el elemento de más arriba gana; los clusters
    // acercan el zoom; un click en el vacío selecciona ese punto del mapa
    // (pronóstico, aire y sismicidad de la zona en el panel de detalle).
    map.on("click", async (e) => {
      const present = INTERACTIVE.filter((id) => map.getLayer(id));
      // Primero justo bajo el puntero; si no hay nada, en un margen alrededor
      // (mayor con el dedo) para que los puntos pequeños sean fáciles de tocar.
      let hits = map.queryRenderedFeatures(e.point, { layers: present });
      if (hits.length === 0) {
        const ev = e.originalEvent as Event;
        const touch = (typeof PointerEvent !== "undefined" && ev instanceof PointerEvent && ev.pointerType === "touch") || (typeof TouchEvent !== "undefined" && ev instanceof TouchEvent);
        const r = touch ? TOUCH_HIT_PX : MOUSE_HIT_PX;
        hits = map.queryRenderedFeatures(
          [
            [e.point.x - r, e.point.y - r],
            [e.point.x + r, e.point.y + r],
          ],
          { layers: present }
        );
      }
      for (const layerId of INTERACTIVE) {
        const f = hits.find((h) => h.layer.id === layerId);
        if (!f) continue;
        if (layerId === "quake-clusters" && f.geometry.type === "Point") {
          const source = map.getSource("quakes") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(f.properties.cluster_id as number);
          map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: zoom + 0.5 });
          return;
        }
        const selection = toSelection(layerId, f);
        if (selection) {
          propsRef.current.onSelect(selection);
          return;
        }
      }
      const { lng, lat } = e.lngLat.wrap();
      propsRef.current.onSelect({ kind: "point", lon: lng, lat });
    });
    map.on("mousemove", (e) => {
      const present = INTERACTIVE.filter((id) => map.getLayer(id));
      const hit = present.length > 0 && map.queryRenderedFeatures(e.point, { layers: present }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });

    // Onda de los sismos recientes (se respeta prefers-reduced-motion).
    let raf = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PERIOD = 2000;
    const animatePulse = (t: number) => {
      raf = requestAnimationFrame(animatePulse);
      if (!isMapLoadedRef.current || !map.getLayer("quake-pulse")) return;
      const phase = (t % PERIOD) / PERIOD;
      map.setPaintProperty("quake-pulse", "circle-radius", ["+", MAG_RADIUS, phase * 18] as ExpressionSpecification);
      map.setPaintProperty("quake-pulse", "circle-stroke-opacity", 0.8 * (1 - phase));
    };
    if (!reduceMotion) raf = requestAnimationFrame(animatePulse);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);
    mapRef.current = map;

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      isMapLoadedRef.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialización única; los cambios se aplican en los effects de abajo.
  }, []);

  // 1b. Cambio de basemap: setStyle() borra fuentes/capas/iconos.
  const isFirstBasemapRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstBasemapRenderRef.current) {
      isFirstBasemapRenderRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    isMapLoadedRef.current = false;
    map.setStyle(BASEMAP_STYLES[basemap]);
    map.once("styledata", () => {
      isMapLoadedRef.current = true;
      setupLayers(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // 1c. Centrar en un elemento elegido desde la lista o el buscador.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 5), duration: 1200, essential: true });
  }, [focus]);

  // 2. Datos: setData sin recrear el mapa.
  const setData = (sourceId: string, fc: GeoJSON.GeoJSON) => {
    if (!isMapLoadedRef.current) return;
    (mapRef.current?.getSource(sourceId) as GeoJSONSource | undefined)?.setData(fc);
  };
  useEffect(() => setData("quakes", quakeData(data.earthquakes)), [data.earthquakes]);
  useEffect(() => setData("air-quality", airData(data.airQuality)), [data.airQuality]);
  useEffect(() => setData("fires", fireData(data.fires)), [data.fires]);
  useEffect(() => setData("disasters", data.disasters), [data.disasters]);
  useEffect(() => setData("volcanoes", withIds(data.volcanoes)), [data.volcanoes]);
  useEffect(() => setData("volcano-catalog", data.volcanoCatalog ? withIds(data.volcanoCatalog) : EMPTY), [data.volcanoCatalog]);
  useEffect(() => setData("cyclones", data.cyclones), [data.cyclones]);
  useEffect(() => setData("selection", selectionData(selectedPoint)), [selectedPoint]);
  useEffect(() => {
    setData("iss", data.iss);
    const { track, footprint } = issDerived(data.iss);
    setData("iss-track", track);
    setData("iss-footprint", footprint);
  }, [data.iss]);

  // 2b. Radar: cambia el cuadro según el cursor de tiempo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const source = map.getSource("radar") as RasterTileSource | undefined;
    if (!radarTiles) {
      if (map.getLayer("radar")) map.removeLayer("radar");
      if (source) map.removeSource("radar");
      return;
    }
    if (source) source.setTiles([radarTiles]);
    else addRadar(map, radarTiles);
     
  }, [radarTiles]);

  // 3. Tiempo de referencia: antigüedad, onda de la última hora y día/noche.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    setData("night", nightData(refTime));
    if (map.getLayer("quakes")) {
      map.setPaintProperty("quakes", "circle-opacity", ageOpacity(refTime, "time"));
      map.setPaintProperty("quakes", "circle-stroke-opacity", ageOpacity(refTime, "time"));
      map.setFilter("quake-pulse", ["all", NOT_CLUSTER, ["<", ["-", refTime, ["get", "time"]], PULSE_WINDOW_MS]] as FilterSpecification);
    }
    if (map.getLayer("fires")) map.setPaintProperty("fires", "icon-opacity", fireOpacity(refTime));
  }, [refTime]);

  // 4. Visibilidad por grupo (setLayoutProperty, sin latencia).
  const visKey = (Object.keys(LAYER_GROUPS) as LayerKey[]).map((k) => (visibility[k] ? 1 : 0)).join("");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    for (const [key, ids] of Object.entries(LAYER_GROUPS) as [LayerKey, string[]][]) {
      const value = visibility[key] ? "visible" : "none";
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKey]);

  return (
    <div className="relative h-full w-full bg-ds-canvas">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
