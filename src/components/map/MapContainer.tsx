'use client';

import React, { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON, IssGeoJSON, VolcanoGeoJSON, AirQualityModelGeoJSON, EarthquakeProperties, AirQualityProperties, FireProperties, WeatherProperties, DisasterProperties, IssProperties, VolcanoProperties, AirQualityModelProperties } from "@/lib/types";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { BASEMAP_STYLES, type Basemap } from "@/lib/mapStyles";
import { layers, scales, marker } from "@/design-system/tokens";
import {
  earthquakePopup,
  airQualityPopup,
  firePopup,
  weatherPopup,
  disasterPopup,
  issPopup,
  volcanoPopup,
  airQualityModelPopup,
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
  showQuakes: boolean;
  showAirQuality: boolean;
  showFires: boolean;
  showWeather: boolean;
  showDisasters: boolean;
  showIss: boolean;
  showVolcanoes: boolean;
  showAirQualityModel: boolean;
  onSelectEarthquake?: (id: string) => void;
  onViewChange?: (view: MapView) => void;
  initialView?: MapView;
  basemap: Basemap;
}

export default function MapContainer({
  earthquakes,
  airQuality,
  fires,
  weather,
  disasters,
  iss,
  volcanoes,
  airQualityModel,
  showQuakes,
  showAirQuality,
  showFires,
  showWeather,
  showDisasters,
  showIss,
  showVolcanoes,
  showAirQualityModel,
  onSelectEarthquake,
  onViewChange,
  initialView = DEFAULT_MAP_VIEW,
  basemap,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);
  const onSelectEarthquakeRef = useRef(onSelectEarthquake);
  onSelectEarthquakeRef.current = onSelectEarthquake;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;


  // Refs con los datos/visibilidad más recientes: la función setupLayers()
  // se invoca tanto en el "load" inicial como después de cada cambio de
  // basemap (map.setStyle() borra todas las fuentes/capas de MapLibre), y
  // en ambos casos debe usar el estado más reciente, no el del montaje.
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const earthquakesRef = useRef(earthquakes);
  earthquakesRef.current = earthquakes;
  const airQualityRef = useRef(airQuality);
  airQualityRef.current = airQuality;
  const firesRef = useRef(fires);
  firesRef.current = fires;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const disastersRef = useRef(disasters);
  disastersRef.current = disasters;
  const issRef = useRef(iss);
  issRef.current = iss;
  const volcanoesRef = useRef(volcanoes);
  volcanoesRef.current = volcanoes;
  const airQualityModelRef = useRef(airQualityModel);
  airQualityModelRef.current = airQualityModel;
  const showQuakesRef = useRef(showQuakes);
  showQuakesRef.current = showQuakes;
  const showAirQualityRef = useRef(showAirQuality);
  showAirQualityRef.current = showAirQuality;
  const showFiresRef = useRef(showFires);
  showFiresRef.current = showFires;
  const showWeatherRef = useRef(showWeather);
  showWeatherRef.current = showWeather;
  const showDisastersRef = useRef(showDisasters);
  showDisastersRef.current = showDisasters;
  const showIssRef = useRef(showIss);
  showIssRef.current = showIss;
  const showVolcanoesRef = useRef(showVolcanoes);
  showVolcanoesRef.current = showVolcanoes;
  const showAirQualityModelRef = useRef(showAirQualityModel);
  showAirQualityModelRef.current = showAirQualityModel;

  // Agrega todas las fuentes/capas/popups/cursores de la app al mapa. Se usa
  // tanto en la carga inicial como después de cada map.setStyle() (cambio
  // de basemap), que borra sources/layers pero no destruye la instancia del
  // mapa. Lee siempre el estado más reciente vía los refs de arriba.
  function setupLayers(map: MapLibreMap) {
    // Etiquetas de texto legibles según el basemap: halo oscuro sobre
    // oscuro/satélite, halo blanco sobre el mapa claro.
    const onLight = basemapRef.current === "light";
    const labelHalo = onLight ? marker.haloOnLight : marker.halo;

    // Fuente y capa para Sismos (USGS)
    map.addSource("earthquakes-source", {
      type: "geojson",
      data: earthquakesRef.current,
    });

    map.addLayer({
      id: "earthquakes-layer",
      type: "circle",
      source: "earthquakes-source",
      layout: {
        visibility: showQuakesRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "mag"], 1],
          2, 4,
          5, 9,
          7, 18,
          9, 32
        ],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "mag"], 1],
          ...scales.magnitude.flatMap((s) => [s.stop, s.color]),
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": marker.stroke,
      },
    });

    // Fuente y capa para Calidad del Aire (OpenAQ)
    map.addSource("air-quality-source", {
      type: "geojson",
      data: airQualityRef.current,
    });

    map.addLayer({
      id: "air-quality-layer",
      type: "circle",
      source: "air-quality-source",
      layout: {
        visibility: showAirQualityRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 7,
        "circle-color": [
          "match",
          ["get", "category"],
          "good", scales.aqi.good,
          "moderate", scales.aqi.moderate,
          "unhealthy", scales.aqi.unhealthy,
          "hazardous", scales.aqi.hazardous,
          scales.aqi.unknown
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.strokeDark,
      },
    });

    // Fuente y capa para Incendios (NASA FIRMS)
    map.addSource("fires-source", {
      type: "geojson",
      data: firesRef.current,
    });

    map.addLayer({
      id: "fires-layer",
      type: "circle",
      source: "fires-source",
      layout: {
        visibility: showFiresRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frp"], 10],
          10, 4,
          50, 8,
          200, 14,
          500, 22
        ],
        "circle-color": layers.fires,
        "circle-opacity": 0.8,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.fireStroke,
      },
    });

    // Fuente y capa para Clima (Open-Meteo) - etiqueta de texto, no circulo,
    // para no tapar los puntos de calidad de aire en las mismas ciudades
    map.addSource("weather-source", {
      type: "geojson",
      data: weatherRef.current,
    });

    // Capa invisible con hit-target circular: la capa de texto (glifo de
    // temperatura) por si sola es un blanco de click minusculo y poco
    // fiable, esta capa da un area de click razonable debajo del texto.
    map.addLayer({
      id: "weather-hit-layer",
      type: "circle",
      source: "weather-source",
      layout: {
        visibility: showWeatherRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(0,0,0,0.01)",
      },
    });

    map.addLayer({
      id: "weather-layer",
      type: "symbol",
      source: "weather-source",
      layout: {
        visibility: showWeatherRef.current ? "visible" : "none",
        "text-field": ["concat", ["to-string", ["round", ["get", "temperature"]]], "°C"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, -1.8],
        "text-anchor": "bottom",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": onLight ? marker.weatherTextOnLight : marker.weatherText,
        "text-halo-color": labelHalo,
        "text-halo-width": 2,
      },
    });

    // Fuente y capa para Desastres Globales (GDACS: inundaciones, ciclones,
    // sequias, volcanes - EQ y WF se excluyen para no duplicar USGS/FIRMS)
    map.addSource("disasters-source", {
      type: "geojson",
      data: disastersRef.current,
    });

    map.addLayer({
      id: "disasters-layer",
      type: "circle",
      source: "disasters-source",
      layout: {
        visibility: showDisastersRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 9,
        "circle-color": [
          "match",
          ["get", "alertLevel"],
          "Red", scales.alert.Red,
          "Orange", scales.alert.Orange,
          scales.alert.Green
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": marker.stroke,
      },
    });

    // Fuente y capa para la ISS (posicion interpolada de la trayectoria OEM de NASA)
    map.addSource("iss-source", {
      type: "geojson",
      data: issRef.current,
    });

    map.addLayer({
      id: "iss-layer",
      type: "circle",
      source: "iss-source",
      layout: {
        visibility: showIssRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 7,
        "circle-color": marker.issFill,
        "circle-opacity": 0.95,
        "circle-stroke-width": 2,
        "circle-stroke-color": marker.issStroke,
      },
    });

    map.addLayer({
      id: "iss-label-layer",
      type: "symbol",
      source: "iss-source",
      layout: {
        visibility: showIssRef.current ? "visible" : "none",
        "text-field": "ISS",
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, -1.5],
        "text-anchor": "bottom",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": onLight ? marker.labelTextOnLight : marker.labelText,
        "text-halo-color": labelHalo,
        "text-halo-width": 2,
      },
    });

    // Fuente y capa para Volcanes (Smithsonian GVP - catalogo estatico de
    // volcanes del Holoceno; distinto de "VO" en GDACS, que son erupciones
    // activas). Poll diario, casi no cambia.
    map.addSource("volcanoes-source", {
      type: "geojson",
      data: volcanoesRef.current,
    });

    // Capa invisible mas grande solo para hacer el hit-target de click mas
    // facil de acertar (el circulo visible de 5px es muy pequeño para tocar
    // con precision, sobre todo en pantallas tactiles).
    map.addLayer({
      id: "volcanoes-hit-layer",
      type: "circle",
      source: "volcanoes-source",
      layout: {
        visibility: showVolcanoesRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(0,0,0,0.01)",
      },
    });

    map.addLayer({
      id: "volcanoes-layer",
      type: "circle",
      source: "volcanoes-source",
      layout: {
        visibility: showVolcanoesRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 5,
        "circle-color": layers.volcanoes,
        "circle-opacity": 0.75,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": marker.volcanoStroke,
      },
    });

    // Fuente y capa para Calidad del Aire Modelada (Open-Meteo) - anillo
    // hueco en las mismas coordenadas del AQ observado, para comparar
    // visualmente "relleno" (observado) vs "contorno" (modelo)
    map.addSource("air-quality-model-source", {
      type: "geojson",
      data: airQualityModelRef.current,
    });

    // Capa invisible mas generosa solo para hit-testing: el anillo visible
    // de abajo solo intercepta clicks cerca del borde/stroke (con
    // circle-color totalmente transparente MapLibre no detecta clicks
    // dentro del circulo), asi que esta capa cubre toda el area del punto.
    map.addLayer({
      id: "air-quality-model-hit-layer",
      type: "circle",
      source: "air-quality-model-source",
      layout: {
        visibility: showAirQualityModelRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 14,
        "circle-color": "rgba(0,0,0,0.01)",
      },
    });

    map.addLayer({
      id: "air-quality-model-layer",
      type: "circle",
      source: "air-quality-model-source",
      layout: {
        visibility: showAirQualityModelRef.current ? "visible" : "none",
      },
      paint: {
        "circle-radius": 11,
        // Casi transparente en vez de "transparent" (alpha 0): con alfa
        // cero MapLibre no detecta clicks dentro del circulo, solo en el
        // borde/stroke - confirmado interactivamente en el navegador.
        "circle-color": "rgba(0,0,0,0.01)",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": [
          "match",
          ["get", "category"],
          "good", scales.aqi.good,
          "moderate", scales.aqi.moderate,
          "unhealthy", scales.aqi.unhealthy,
          "hazardous", scales.aqi.hazardous,
          scales.aqi.unknown
        ],
      },
    });

    // Popup de interacción con Sismos
    map.on("click", "earthquakes-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { mag, place, time, updated } = feature.properties as EarthquakeProperties;

      if (feature.id != null) onSelectEarthquakeRef.current?.(String(feature.id));

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(earthquakePopup({ mag, place, time, updated }, coordinates[2] ?? 0))
        .addTo(map);
    });

    // Popup de interacción con Aire
    map.on("click", "air-quality-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { station, pm25, category, updated } = feature.properties as AirQualityProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(airQualityPopup({ station, pm25, category, updated }))
        .addTo(map);
    });

    // Popup de interacción con Incendios
    map.on("click", "fires-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { frp, confidence, satellite, acquiredAt } = feature.properties as FireProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(firePopup({ frp, confidence, satellite, acquiredAt }))
        .addTo(map);
    });

    // Popup de interacción con Clima (via weather-hit-layer, area de click
    // mas grande y fiable que el glifo de texto)
    map.on("click", "weather-hit-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { city, temperature, humidity, windSpeed, weatherDescription, updated } = feature.properties as WeatherProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(weatherPopup({ city, temperature, humidity, windSpeed, weatherDescription, updated }))
        .addTo(map);
    });

    // Popup de interacción con Desastres Globales
    map.on("click", "disasters-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { name, eventTypeLabel, country, alertLevel, fromDate, toDate, reportUrl } = feature.properties as DisasterProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(disasterPopup({ name, eventTypeLabel, country, alertLevel, fromDate, toDate, reportUrl }))
        .addTo(map);
    });

    // Popup de interacción con la ISS
    map.on("click", "iss-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { altitudeKm, velocityKmS, timestamp } = feature.properties as IssProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(issPopup({ altitudeKm, velocityKmS, timestamp }))
        .addTo(map);
    });

    // Popup de interacción con Volcanes (via volcanoes-hit-layer, area de
    // click mas grande y fiable que el circulo visible de 5px)
    map.on("click", "volcanoes-hit-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { name, country, volcanoType, lastEruptionYear, elevationM } = feature.properties as VolcanoProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(volcanoPopup({ name, country, volcanoType, lastEruptionYear, elevationM }))
        .addTo(map);
    });

    // Popup de interacción con Calidad del Aire Modelada (via
    // air-quality-model-hit-layer, cubre toda el area del anillo)
    map.on("click", "air-quality-model-hit-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { city, pm25, category, updated } = feature.properties as AirQualityModelProperties;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(airQualityModelPopup({ city, pm25, updated }, category))
        .addTo(map);
    });

    // Efecto cursor pointer
    map.on("mouseenter", "earthquakes-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "earthquakes-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "air-quality-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "air-quality-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "fires-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "fires-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "weather-hit-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "weather-hit-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "disasters-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "disasters-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "iss-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "iss-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "volcanoes-hit-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "volcanoes-hit-layer", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "air-quality-model-hit-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "air-quality-model-hit-layer", () => { map.getCanvas().style.cursor = ""; });
  }

  // 1. Inicialización única del mapa (Previene memory leaks y pérdida de contexto WebGL)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[basemap],
      center: [initialView.lng, initialView.lat],
      zoom: initialView.zoom,
      pitch: 0,
      // preserveDrawingBuffer: true evita que Chromium capture un buffer en blanco/negro
      // al hacer el snapshot para backdrop-filter (blur) de los paneles glass que
      // flotan sobre el canvas WebGL del mapa. Sin esto, los paneles glass se ven
      // solidos negros en vez de mostrar el blur real, especialmente en tema claro.
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
      maxPitch: 60,
      attributionControl: false,
    });

    // Zoom/brújula arriba a la derecha y atribución compacta abajo a la
    // izquierda; globals.css (.ep-map-stage) los estiliza y los desplaza con
    // --ep-inset-* para que no queden bajo los paneles flotantes.
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("moveend", () => {
      const center = map.getCenter();
      onViewChangeRef.current?.({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
    });

    map.on("load", () => {
      isMapLoadedRef.current = true;
      setupLayers(map);
    });

    // Soporte de redimensionamiento automático
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      isMapLoadedRef.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialización única e intencional; los updates posteriores de earthquakes/airQuality/fires/weather/disasters/iss/volcanoes/airQualityModel/showQuakes/showAirQuality/showFires/showWeather/showDisasters/showIss/showVolcanoes/showAirQualityModel/basemap se manejan en los effects de abajo vía setData/setLayoutProperty/setStyle sin re-crear el mapa.
  }, []);

  // 1b. Cambio de basemap: map.setStyle() reemplaza el estilo completo y
  // borra todas las fuentes/capas de MapLibre, así que hay que
  // re-agregarlas (setupLayers) cuando el nuevo estilo termina de cargar.
  // Se salta la primera ejecución porque el mapa ya se crea con el estilo
  // correcto en el effect de inicialización.
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

  // 2. Actualización de datos de Sismos SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("earthquakes-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(earthquakes);
    }
  }, [earthquakes]);

  // 3. Actualización de datos de Calidad del Aire SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("air-quality-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(airQuality);
    }
  }, [airQuality]);

  // 3b. Actualización de datos de Incendios SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("fires-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(fires);
    }
  }, [fires]);

  // 3c. Actualización de datos de Clima SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("weather-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(weather);
    }
  }, [weather]);

  // 3d. Actualización de datos de Desastres Globales SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("disasters-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(disasters);
    }
  }, [disasters]);

  // 3e. Actualización de datos de la ISS SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("iss-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(iss);
    }
  }, [iss]);

  // 3f. Actualización de datos de Volcanes SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("volcanoes-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(volcanoes);
    }
  }, [volcanoes]);

  // 3g. Actualización de datos de Calidad del Aire Modelada SIN recargar el mapa
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const source = mapRef.current.getSource("air-quality-model-source") as GeoJSONSource | undefined;
    if (source) {
      source.setData(airQualityModel);
    }
  }, [airQualityModel]);

  // 4. Conmutación reactiva de visibilidad de capas (Zero-latency toggle)
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("earthquakes-layer")) {
      mapRef.current.setLayoutProperty("earthquakes-layer", "visibility", showQuakes ? "visible" : "none");
    }
  }, [showQuakes]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("air-quality-layer")) {
      mapRef.current.setLayoutProperty("air-quality-layer", "visibility", showAirQuality ? "visible" : "none");
    }
  }, [showAirQuality]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("fires-layer")) {
      mapRef.current.setLayoutProperty("fires-layer", "visibility", showFires ? "visible" : "none");
    }
  }, [showFires]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("weather-layer")) {
      mapRef.current.setLayoutProperty("weather-layer", "visibility", showWeather ? "visible" : "none");
    }
    if (mapRef.current.getLayer("weather-hit-layer")) {
      mapRef.current.setLayoutProperty("weather-hit-layer", "visibility", showWeather ? "visible" : "none");
    }
  }, [showWeather]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("disasters-layer")) {
      mapRef.current.setLayoutProperty("disasters-layer", "visibility", showDisasters ? "visible" : "none");
    }
  }, [showDisasters]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("iss-layer")) {
      mapRef.current.setLayoutProperty("iss-layer", "visibility", showIss ? "visible" : "none");
    }
    if (mapRef.current.getLayer("iss-label-layer")) {
      mapRef.current.setLayoutProperty("iss-label-layer", "visibility", showIss ? "visible" : "none");
    }
  }, [showIss]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("volcanoes-layer")) {
      mapRef.current.setLayoutProperty("volcanoes-layer", "visibility", showVolcanoes ? "visible" : "none");
    }
    if (mapRef.current.getLayer("volcanoes-hit-layer")) {
      mapRef.current.setLayoutProperty("volcanoes-hit-layer", "visibility", showVolcanoes ? "visible" : "none");
    }
  }, [showVolcanoes]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("air-quality-model-layer")) {
      mapRef.current.setLayoutProperty("air-quality-model-layer", "visibility", showAirQualityModel ? "visible" : "none");
    }
    if (mapRef.current.getLayer("air-quality-model-hit-layer")) {
      mapRef.current.setLayoutProperty("air-quality-model-hit-layer", "visibility", showAirQualityModel ? "visible" : "none");
    }
  }, [showAirQualityModel]);

  return (
    <div className="relative h-full w-full bg-ds-canvas">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
