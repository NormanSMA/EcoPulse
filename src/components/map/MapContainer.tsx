'use client';

import React, { useEffect, useRef } from "react";
import maplibregl, {
  GeoJSONSource,
  Map as MapLibreMap,
  type ExpressionSpecification,
  type FilterSpecification,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import type {
  EarthquakeGeoJSON,
  AirQualityGeoJSON,
  FireGeoJSON,
  WeatherGeoJSON,
  DisasterGeoJSON,
  IssGeoJSON,
  VolcanoGeoJSON,
  AirQualityModelGeoJSON,
  CycloneGeoJSON,
  EarthquakeProperties,
  AirQualityProperties,
  FireProperties,
  WeatherProperties,
  DisasterProperties,
  IssProperties,
  VolcanoProperties,
  AirQualityModelProperties,
  CycloneProperties,
} from "@/lib/types";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { BASEMAP_STYLES, type Basemap } from "@/lib/mapStyles";
import { layers, scales, marker, withAlpha } from "@/design-system/tokens";
import { registerMapIcons } from "@/lib/mapIcons";
import { nightPolygon, footprintRing, unwrapLongitudes } from "@/lib/geoShapes";
import {
  earthquakePopup,
  airQualityPopup,
  firePopup,
  weatherPopup,
  disasterPopup,
  issPopup,
  volcanoPopup,
  airQualityModelPopup,
  cyclonePopup,
} from "@/lib/popupHtml";

interface MapContainerProps {
  earthquakes: EarthquakeGeoJSON;
  airQuality: AirQualityGeoJSON;
  fires: FireGeoJSON;
  weather: WeatherGeoJSON;
  disasters: DisasterGeoJSON;
  iss: IssGeoJSON;
  volcanoes: VolcanoGeoJSON;
  airQualityModel: AirQualityModelGeoJSON;
  cyclones: CycloneGeoJSON;
  showQuakes: boolean;
  showAirQuality: boolean;
  showFires: boolean;
  showWeather: boolean;
  showDisasters: boolean;
  showIss: boolean;
  showVolcanoes: boolean;
  showAirQualityModel: boolean;
  showCyclones: boolean;
  showDayNight: boolean;
  /** Instante de referencia (ahora o cursor de reproducción): antigüedad y día/noche. */
  refTime: number;
  onSelectEarthquake?: (id: string) => void;
  onViewChange?: (view: MapView) => void;
  initialView?: MapView;
  basemap: Basemap;
  /** Punto a centrar (p.ej. al tocar un evento de la lista); key fuerza re-vuelo. */
  focus?: { lng: number; lat: number; key: number } | null;
  selectedEarthquakeId?: string | null;
}

type Visibility = Pick<
  MapContainerProps,
  | "showQuakes"
  | "showAirQuality"
  | "showFires"
  | "showWeather"
  | "showDisasters"
  | "showIss"
  | "showVolcanoes"
  | "showAirQualityModel"
  | "showCyclones"
  | "showDayNight"
>;

// Capas de MapLibre que controla cada toggle del panel.
const LAYER_GROUPS: Record<keyof Visibility, string[]> = {
  showDayNight: ["night-fill"],
  showQuakes: ["quake-clusters", "quake-cluster-count", "quakes", "quake-pulse", "quake-selected"],
  showAirQuality: ["air-quality"],
  showAirQualityModel: ["air-quality-model-hit", "air-quality-model"],
  showFires: ["fires-heat", "fires"],
  showWeather: ["weather-hit", "weather"],
  showDisasters: ["disasters"],
  showVolcanoes: ["volcanoes"],
  showCyclones: ["cyclone-cone", "cyclone-cone-line", "cyclone-track", "cyclone-forecast", "cyclone-position"],
  showIss: ["iss-footprint", "iss-footprint-line", "iss-track-past", "iss-track-future", "iss"],
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const FONT_BOLD = ["Noto Sans Bold"];
const NOT_CLUSTER: FilterSpecification = ["!", ["has", "point_count"]];
const HOUR_MS = 3_600_000;
const PULSE_WINDOW_MS = HOUR_MS;

const MAG = ["coalesce", ["get", "mag"], 1] as ExpressionSpecification;
const MAG_COLOR = ["interpolate", ["linear"], MAG, ...scales.magnitude.flatMap((s) => [s.stop, s.color])] as ExpressionSpecification;
const MAG_RADIUS = ["interpolate", ["linear"], MAG, 2, 4, 5, 9, 7, 18, 9, 32] as ExpressionSpecification;
const STORM_COLOR = [
  "match",
  ["get", "category"],
  ...scales.storm.flatMap((s) => [s.key, s.color]),
  scales.storm[1].color,
] as unknown as ExpressionSpecification;
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

// MapLibre descarta los ids de feature que no son numéricos (los de USGS son
// strings como "us7000abcd"), así que se copian a properties._id.
function quakeData(fc: EarthquakeGeoJSON) {
  return { ...fc, features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, _id: String(f.id) } })) };
}

// Las expresiones no parsean fechas ISO: se precalcula _t (ms).
function fireData(fc: FireGeoJSON) {
  return { ...fc, features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, _t: Date.parse(f.properties.acquiredAt) } })) };
}

// Trayectoria real (pasada + futura) y huella de visibilidad de la ISS.
function issDerived(iss: IssGeoJSON): { track: GeoJSON.FeatureCollection; footprint: GeoJSON.FeatureCollection } {
  const f = iss.features[0];
  if (!f?.properties.track) return { track: EMPTY, footprint: EMPTY };
  const { past, future } = f.properties.track;
  const [lon, lat] = f.geometry.coordinates;
  const joined = unwrapLongitudes([...past, ...future.slice(1)].map(([x, y]) => [x, y] as [number, number]));
  // Alinea la línea con el marcador (mismo "mundo" de longitudes).
  const anchorIdx = Math.max(0, past.length - 1);
  const shift = joined[anchorIdx] ? Math.round((lon - joined[anchorIdx][0]) / 360) * 360 : 0;
  const line = joined.map(([x, y]) => [x + shift, y]);
  const track: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { kind: "past" }, geometry: { type: "LineString", coordinates: line.slice(0, anchorIdx + 1) } },
      { type: "Feature", properties: { kind: "future" }, geometry: { type: "LineString", coordinates: line.slice(anchorIdx) } },
    ],
  };
  const footprint: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [footprintRing(lon, lat, f.properties.altitudeKm)] } },
    ],
  };
  return { track, footprint };
}

function nightData(refTime: number): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [nightPolygon(new Date(refTime))] } }],
  };
}

export default function MapContainer(props: MapContainerProps) {
  const {
    earthquakes,
    airQuality,
    fires,
    weather,
    disasters,
    iss,
    volcanoes,
    airQualityModel,
    cyclones,
    refTime,
    onViewChange,
    initialView = DEFAULT_MAP_VIEW,
    basemap,
    focus,
    selectedEarthquakeId = null,
  } = props;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  // Props más recientes: setupLayers() corre en el "load" inicial y tras
  // cada map.setStyle() (cambio de basemap, que borra fuentes y capas), y
  // los handlers de click se registran una sola vez.
  const propsRef = useRef(props);
  propsRef.current = props;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  function setupLayers(map: MapLibreMap) {
    const p = propsRef.current;
    const vis = (key: keyof Visibility) => (p[key] ? "visible" : "none") as "visible" | "none";
    const onLight = p.basemap === "light";
    const labelHalo = onLight ? marker.haloOnLight : marker.halo;
    const labelText = onLight ? marker.labelTextOnLight : marker.labelText;
    const { track, footprint } = issDerived(p.iss);

    registerMapIcons(map);

    // ---------- Fuentes ----------
    map.addSource("night", { type: "geojson", data: nightData(p.refTime) });
    map.addSource("quakes", {
      type: "geojson",
      data: quakeData(p.earthquakes),
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: 4,
      clusterProperties: { maxMag: ["max", ["coalesce", ["get", "mag"], 0]] },
    });
    map.addSource("air-quality", { type: "geojson", data: p.airQuality });
    map.addSource("air-quality-model", { type: "geojson", data: p.airQualityModel });
    map.addSource("fires", { type: "geojson", data: fireData(p.fires) });
    map.addSource("weather", { type: "geojson", data: p.weather });
    map.addSource("disasters", { type: "geojson", data: p.disasters });
    map.addSource("volcanoes", { type: "geojson", data: p.volcanoes });
    map.addSource("cyclones", { type: "geojson", data: p.cyclones });
    map.addSource("iss", { type: "geojson", data: p.iss });
    map.addSource("iss-track", { type: "geojson", data: track });
    map.addSource("iss-footprint", { type: "geojson", data: footprint });

    // ---------- Capas (de abajo hacia arriba) ----------
    map.addLayer({
      id: "night-fill",
      type: "fill",
      source: "night",
      layout: { visibility: vis("showDayNight") },
      paint: { "fill-color": marker.night, "fill-opacity": onLight ? 0.16 : 0.32, "fill-antialias": false },
    });

    map.addLayer({
      id: "iss-footprint",
      type: "fill",
      source: "iss-footprint",
      layout: { visibility: vis("showIss") },
      paint: { "fill-color": marker.issStroke, "fill-opacity": 0.08 },
    });
    map.addLayer({
      id: "iss-footprint-line",
      type: "line",
      source: "iss-footprint",
      layout: { visibility: vis("showIss") },
      paint: { "line-color": marker.issStroke, "line-opacity": 0.5, "line-width": 1, "line-dasharray": [2, 2] },
    });

    map.addLayer({
      id: "cyclone-cone",
      type: "fill",
      source: "cyclones",
      filter: ["==", ["get", "kind"], "cone"],
      layout: { visibility: vis("showCyclones") },
      paint: { "fill-color": marker.cone, "fill-opacity": onLight ? 0.18 : 0.1 },
    });
    map.addLayer({
      id: "cyclone-cone-line",
      type: "line",
      source: "cyclones",
      filter: ["==", ["get", "kind"], "cone"],
      layout: { visibility: vis("showCyclones") },
      paint: { "line-color": onLight ? marker.labelTextOnLight : marker.cone, "line-opacity": 0.45, "line-width": 1, "line-dasharray": [3, 2] },
    });
    map.addLayer({
      id: "cyclone-track",
      type: "line",
      source: "cyclones",
      filter: ["all", ["==", ["get", "kind"], "track"], ["!=", ["get", "forecast"], true]],
      layout: { visibility: vis("showCyclones"), "line-cap": "round" },
      paint: { "line-color": STORM_COLOR, "line-width": 3.5 },
    });
    map.addLayer({
      id: "cyclone-forecast",
      type: "line",
      source: "cyclones",
      filter: ["all", ["==", ["get", "kind"], "track"], ["==", ["get", "forecast"], true]],
      layout: { visibility: vis("showCyclones") },
      paint: { "line-color": STORM_COLOR, "line-width": 2.5, "line-dasharray": [1.5, 1.5] },
    });

    // Incendios: mapa de calor con zoom alejado, iconos al acercarse.
    map.addLayer({
      id: "fires-heat",
      type: "heatmap",
      source: "fires",
      maxzoom: 7,
      layout: { visibility: vis("showFires") },
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
      layout: { visibility: vis("showAirQuality") },
      paint: {
        "circle-radius": 7,
        "circle-color": AQI_COLOR,
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.strokeDark,
      },
    });
    // Hit-target: con color 100% transparente MapLibre no detecta clicks
    // dentro del círculo, solo en el borde.
    map.addLayer({
      id: "air-quality-model-hit",
      type: "circle",
      source: "air-quality-model",
      layout: { visibility: vis("showAirQualityModel") },
      paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0.01)" },
    });
    map.addLayer({
      id: "air-quality-model",
      type: "circle",
      source: "air-quality-model",
      layout: { visibility: vis("showAirQualityModel") },
      paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0.01)", "circle-stroke-width": 2.5, "circle-stroke-color": AQI_COLOR },
    });

    map.addLayer({
      id: "volcanoes",
      type: "symbol",
      source: "volcanoes",
      layout: { visibility: vis("showVolcanoes"), "icon-image": "ep-volcano", "icon-allow-overlap": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 1.1] },
    });

    map.addLayer({
      id: "fires",
      type: "symbol",
      source: "fires",
      minzoom: 5.5,
      layout: {
        visibility: vis("showFires"),
        "icon-image": "ep-fire",
        "icon-allow-overlap": true,
        "icon-size": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 5], 0, 0.7, 100, 1.1, 500, 1.5],
      },
      paint: {
        "icon-opacity": fireOpacity(p.refTime),
      },
    });

    map.addLayer({
      id: "weather-hit",
      type: "circle",
      source: "weather",
      layout: { visibility: vis("showWeather") },
      paint: { "circle-radius": 12, "circle-color": "rgba(0,0,0,0.01)" },
    });
    map.addLayer({
      id: "weather",
      type: "symbol",
      source: "weather",
      layout: {
        visibility: vis("showWeather"),
        "text-field": ["concat", ["to-string", ["round", ["get", "temperature"]]], "°"],
        "text-font": FONT_BOLD,
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": onLight ? marker.weatherTextOnLight : marker.weatherText,
        "text-halo-color": labelHalo,
        "text-halo-width": 2,
      },
    });

    // Sismos: clusters con zoom alejado (color = mayor magnitud del grupo).
    map.addLayer({
      id: "quake-clusters",
      type: "circle",
      source: "quakes",
      filter: ["has", "point_count"],
      layout: { visibility: vis("showQuakes") },
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
        visibility: vis("showQuakes"),
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
      layout: { visibility: vis("showQuakes") },
      paint: {
        "circle-radius": MAG_RADIUS,
        "circle-color": MAG_COLOR,
        "circle-opacity": ageOpacity(p.refTime, "time"),
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.stroke,
        "circle-stroke-opacity": ageOpacity(p.refTime, "time"),
      },
    });
    // Onda expansiva para los sismos de la última hora (animada en rAF).
    map.addLayer({
      id: "quake-pulse",
      type: "circle",
      source: "quakes",
      filter: ["all", NOT_CLUSTER, ["<", ["-", p.refTime, ["get", "time"]], PULSE_WINDOW_MS]] as FilterSpecification,
      layout: { visibility: vis("showQuakes") },
      paint: {
        "circle-radius": MAG_RADIUS,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": MAG_COLOR,
        "circle-stroke-opacity": 0,
      },
    });
    map.addLayer({
      id: "quake-selected",
      type: "circle",
      source: "quakes",
      filter: ["all", NOT_CLUSTER, ["==", ["get", "_id"], p.selectedEarthquakeId ?? ""]] as FilterSpecification,
      layout: { visibility: vis("showQuakes") },
      paint: {
        "circle-radius": ["+", MAG_RADIUS, 6] as ExpressionSpecification,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 3,
        "circle-stroke-color": marker.selected,
      },
    });

    map.addLayer({
      id: "disasters",
      type: "symbol",
      source: "disasters",
      layout: {
        visibility: vis("showDisasters"),
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
        visibility: vis("showCyclones"),
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
      layout: { visibility: vis("showIss"), "line-cap": "round" },
      paint: {
        "line-color": marker.issStroke,
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });
    map.addLayer({
      id: "iss-track-future",
      type: "line",
      source: "iss-track",
      filter: ["==", ["get", "kind"], "future"],
      layout: { visibility: vis("showIss") },
      paint: { "line-color": marker.issStroke, "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [2, 2] },
    });
    map.addLayer({
      id: "iss",
      type: "symbol",
      source: "iss",
      layout: {
        visibility: vis("showIss"),
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
  }

  // 1. Inicialización única del mapa (evita fugas y pérdida de contexto WebGL).
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

    // Zoom/brújula arriba a la derecha y atribución compacta abajo a la
    // izquierda; globals.css (.ep-map-stage) los desplaza con --ep-inset-*.
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    // Imagen faltante (p.ej. un tipo de evento nuevo): se registra el set y
    // se ignora en silencio si sigue sin existir.
    map.on("styleimagemissing", (e) => {
      if (e.id.startsWith("ep-")) registerMapIcons(map);
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      onViewChangeRef.current?.({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
    });

    map.on("load", () => {
      isMapLoadedRef.current = true;
      setupLayers(map);
    });

    // Handlers de interacción: se registran UNA vez (sobreviven a setStyle,
    // así no se duplican popups al cambiar de mapa base).
    const openPopup = (lngLat: [number, number], html: string) =>
      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false, maxWidth: "300px" }).setLngLat(lngLat).setHTML(html).addTo(map);
    const pointOf = (f: MapGeoJSONFeature): [number, number] | null =>
      f.geometry.type === "Point" ? [f.geometry.coordinates[0], f.geometry.coordinates[1]] : null;

    const handlers: Record<string, (f: MapGeoJSONFeature) => void> = {
      quakes: (f) => {
        const at = pointOf(f);
        if (!at) return;
        const props = f.properties as EarthquakeProperties & { _id?: string };
        if (props._id) propsRef.current.onSelectEarthquake?.(props._id);
        const depth = f.geometry.type === "Point" ? (f.geometry.coordinates[2] ?? 0) : 0;
        openPopup(at, earthquakePopup(props, depth));
      },
      "air-quality": (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, airQualityPopup(f.properties as AirQualityProperties));
      },
      fires: (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, firePopup(f.properties as FireProperties));
      },
      "weather-hit": (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, weatherPopup(f.properties as WeatherProperties));
      },
      disasters: (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, disasterPopup(f.properties as DisasterProperties));
      },
      iss: (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, issPopup(f.properties as IssProperties));
      },
      volcanoes: (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, volcanoPopup(f.properties as VolcanoProperties));
      },
      "air-quality-model-hit": (f) => {
        const at = pointOf(f);
        const props = f.properties as AirQualityModelProperties;
        if (at) openPopup(at, airQualityModelPopup(props, props.category));
      },
      "cyclone-position": (f) => {
        const at = pointOf(f);
        if (at) openPopup(at, cyclonePopup(f.properties as CycloneProperties));
      },
    };
    for (const [layerId, handle] of Object.entries(handlers)) {
      map.on("click", layerId, (e) => {
        const f = e.features?.[0];
        if (f) handle(f);
      });
      map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    }

    // Click en un cluster: acerca el zoom hasta que se separe.
    map.on("click", "quake-clusters", async (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const source = map.getSource("quakes") as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(f.properties.cluster_id as number);
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: zoom + 0.5 });
    });
    map.on("mouseenter", "quake-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "quake-clusters", () => { map.getCanvas().style.cursor = ""; });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialización única; los cambios de datos/visibilidad/basemap se aplican en los effects de abajo sin recrear el mapa.
  }, []);

  // 1b. Cambio de basemap: setStyle() borra fuentes/capas/iconos; se
  // re-agregan cuando el nuevo estilo termina de cargar.
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
  }, [basemap]);

  // 1c. Centrar en un evento seleccionado desde la lista.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 5), duration: 1200, essential: true });
  }, [focus]);

  // 2. Datos: setData sin recrear el mapa.
  const setData = (sourceId: string, data: GeoJSON.GeoJSON) => {
    if (!isMapLoadedRef.current) return;
    (mapRef.current?.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data);
  };
  useEffect(() => setData("quakes", quakeData(earthquakes)), [earthquakes]);
  useEffect(() => setData("air-quality", airQuality), [airQuality]);
  useEffect(() => setData("air-quality-model", airQualityModel), [airQualityModel]);
  useEffect(() => setData("fires", fireData(fires)), [fires]);
  useEffect(() => setData("weather", weather), [weather]);
  useEffect(() => setData("disasters", disasters), [disasters]);
  useEffect(() => setData("volcanoes", volcanoes), [volcanoes]);
  useEffect(() => setData("cyclones", cyclones), [cyclones]);
  useEffect(() => {
    setData("iss", iss);
    const { track, footprint } = issDerived(iss);
    setData("iss-track", track);
    setData("iss-footprint", footprint);
  }, [iss]);

  // 3. Tiempo de referencia: antigüedad de eventos, onda de la última hora y
  // terminador día/noche (en reproducción siguen al cursor).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    setData("night", nightData(refTime));
    if (map.getLayer("quakes")) {
      map.setPaintProperty("quakes", "circle-opacity", ageOpacity(refTime, "time"));
      map.setPaintProperty("quakes", "circle-stroke-opacity", ageOpacity(refTime, "time"));
      map.setFilter("quake-pulse", ["all", NOT_CLUSTER, ["<", ["-", refTime, ["get", "time"]], PULSE_WINDOW_MS]] as FilterSpecification);
    }
    if (map.getLayer("fires")) {
      map.setPaintProperty("fires", "icon-opacity", fireOpacity(refTime));
    }
  }, [refTime]);

  // 4. Selección.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current || !map.getLayer("quake-selected")) return;
    map.setFilter("quake-selected", ["all", NOT_CLUSTER, ["==", ["get", "_id"], selectedEarthquakeId ?? ""]] as FilterSpecification);
  }, [selectedEarthquakeId]);

  // 5. Visibilidad por grupo (sin latencia: setLayoutProperty).
  const visKey = (Object.keys(LAYER_GROUPS) as (keyof Visibility)[]).map((k) => (props[k] ? 1 : 0)).join("");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    for (const [key, ids] of Object.entries(LAYER_GROUPS) as [keyof Visibility, string[]][]) {
      const value = props[key] ? "visible" : "none";
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
