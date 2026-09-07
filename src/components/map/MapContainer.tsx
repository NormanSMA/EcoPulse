'use client';

import React, { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON, IssGeoJSON, VolcanoGeoJSON, AirQualityModelGeoJSON, EarthquakeProperties, AirQualityProperties, FireProperties, WeatherProperties, DisasterProperties, IssProperties, VolcanoProperties, AirQualityModelProperties } from "@/lib/types";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { BASEMAP_STYLES, BASEMAP_LABELS, BASEMAP_ORDER } from "@/lib/mapStyles";
import { useBasemap, type Theme } from "@/design-system/hooks";
import { MorphIcon } from "morphicons/react";
import { Layers, Check } from "lucide";

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
  theme: Theme;
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
  theme,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);
  const onSelectEarthquakeRef = useRef(onSelectEarthquake);
  onSelectEarthquakeRef.current = onSelectEarthquake;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const { basemap, setBasemap } = useBasemap(theme);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Refs con los datos/visibilidad más recientes: la función setupLayers()
  // se invoca tanto en el "load" inicial como después de cada cambio de
  // basemap (map.setStyle() borra todas las fuentes/capas de MapLibre), y
  // en ambos casos debe usar el estado más reciente, no el del montaje.
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
          2, "#fde047",
          4.5, "#fb923c",
          6, "#f43f5e",
          7.5, "#9333ea"
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
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
          "good", "#10b981",
          "moderate", "#f59e0b",
          "unhealthy", "#f97316",
          "hazardous", "#8b5cf6",
          "#cbd5e1"
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0f172a",
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
        "circle-color": "#f97316",
        "circle-opacity": 0.8,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fde047",
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
        "text-color": "#7dd3fc",
        "text-halo-color": "#0f172a",
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
          "Red", "#dc2626",
          "Orange", "#f59e0b",
          "#22c55e"
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
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
        "circle-color": "#e2e8f0",
        "circle-opacity": 0.95,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#38bdf8",
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
        "text-color": "#e2e8f0",
        "text-halo-color": "#0f172a",
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
        "circle-color": "#a16207",
        "circle-opacity": 0.75,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fef3c7",
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
          "good", "#10b981",
          "moderate", "#f59e0b",
          "unhealthy", "#f97316",
          "hazardous", "#8b5cf6",
          "#cbd5e1"
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
      const dateStr = new Date(Number(time)).toLocaleString();
      const updatedStr = new Date(Number(updated)).toLocaleString();

      if (feature.id != null) onSelectEarthquakeRef.current?.(String(feature.id));

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-rose-400 text-sm">Sismo M ${mag ?? 'N/D'}</span>
              <span class="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">USGS</span>
            </div>
            <div class="text-[var(--ds-text-primary)] font-medium leading-snug">${place}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Profundidad: ${coordinates[2] ?? 0} km</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Ocurrió: ${dateStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
          </div>`
        )
        .addTo(map);
    });

    // Popup de interacción con Aire
    map.on("click", "air-quality-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { station, pm25, category, updated } = feature.properties as AirQualityProperties;
      const updatedStr = new Date(updated).toLocaleString();

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-emerald-400 text-sm">Calidad del Aire</span>
              <span class="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">${category}</span>
            </div>
            <div class="text-[var(--ds-text-primary)] font-medium">${station}</div>
            <div class="text-[var(--ds-text-secondary)]">PM2.5: <span class="font-bold text-[var(--ds-text-primary)]">${pm25} µg/m³</span></div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: OpenAQ</div>
          </div>`
        )
        .addTo(map);
    });

    // Popup de interacción con Incendios
    map.on("click", "fires-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { frp, confidence, satellite, acquiredAt } = feature.properties as FireProperties;
      const dateStr = new Date(acquiredAt).toLocaleString();

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-orange-400 text-sm">🔥 Incendio activo</span>
              <span class="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">${satellite}</span>
            </div>
            <div class="text-[var(--ds-text-secondary)]">FRP: <span class="font-bold text-[var(--ds-text-primary)]">${frp} MW</span></div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Confianza: ${confidence}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${dateStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: NASA FIRMS</div>
          </div>`
        )
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
      const updatedStr = new Date(updated).toLocaleString();

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-sky-400 text-sm">${city}</span>
              <span class="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">${weatherDescription}</span>
            </div>
            <div class="text-[var(--ds-text-secondary)]">Temperatura: <span class="font-bold text-[var(--ds-text-primary)]">${temperature}°C</span></div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Humedad: ${humidity}% · Viento: ${windSpeed} km/h</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: Open-Meteo</div>
          </div>`
        )
        .addTo(map);
    });

    // Popup de interacción con Desastres Globales
    map.on("click", "disasters-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { name, eventTypeLabel, country, alertLevel, fromDate, toDate, reportUrl } = feature.properties as DisasterProperties;
      const fromStr = fromDate ? new Date(fromDate).toLocaleString() : "N/D";
      const toStr = toDate ? new Date(toDate).toLocaleString() : "en curso";

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-amber-400 text-sm">${eventTypeLabel}</span>
              <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${alertLevel === 'Red' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}">${alertLevel}</span>
            </div>
            <div class="text-[var(--ds-text-primary)] font-medium leading-snug">${name}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">${country}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Desde: ${fromStr} · Hasta: ${toStr}</div>
            <a href="${reportUrl}" target="_blank" rel="noopener noreferrer" class="text-amber-400 text-[10px] underline">Ver reporte GDACS</a>
          </div>`
        )
        .addTo(map);
    });

    // Popup de interacción con la ISS
    map.on("click", "iss-layer", (e) => {
      if (!e.features || !e.features[0]) return;
      const feature = e.features[0];
      if (feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates.slice();
      const { altitudeKm, velocityKmS, timestamp } = feature.properties as IssProperties;
      const dateStr = new Date(timestamp).toLocaleString();

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-[var(--ds-text-primary)] text-sm">🛰️ Estación Espacial Internacional</span>
            </div>
            <div class="text-[var(--ds-text-secondary)]">Altitud: <span class="font-bold text-[var(--ds-text-primary)]">${altitudeKm.toFixed(1)} km</span></div>
            <div class="text-[var(--ds-text-secondary)]">Velocidad: <span class="font-bold text-[var(--ds-text-primary)]">${velocityKmS.toFixed(2)} km/s</span></div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${dateStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: NASA (trayectoria OEM)</div>
          </div>`
        )
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
      const eruptionText = lastEruptionYear === null
        ? "Sin fecha documentada"
        : lastEruptionYear < 0
          ? `${Math.abs(lastEruptionYear)} a.C.`
          : `${lastEruptionYear} d.C.`;

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-amber-600 text-sm">🌋 ${name}</span>
              <span class="text-[10px] bg-amber-700/20 text-amber-600 px-1.5 py-0.5 rounded">${volcanoType}</span>
            </div>
            <div class="text-[var(--ds-text-primary)] font-medium">${country}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última erupción conocida: ${eruptionText}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Elevación: ${elevationM ?? "N/D"} m</div>
            <div class="text-[var(--ds-text-muted)] text-[10px] italic pt-0.5 border-t [border-color:var(--ds-glass-border)]">Catálogo histórico (GVP) — no es monitoreo en tiempo real</div>
          </div>`
        )
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
      const updatedStr = new Date(updated).toLocaleString();

      new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
        .setLngLat([coordinates[0], coordinates[1]])
        .setHTML(
          `<div class="space-y-1.5 p-1 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-cyan-400 text-sm">Aire (modelo)</span>
              <span class="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded">${category}</span>
            </div>
            <div class="text-[var(--ds-text-primary)] font-medium">${city}</div>
            <div class="text-[var(--ds-text-secondary)]">PM2.5: <span class="font-bold text-[var(--ds-text-primary)]">${pm25} µg/m³</span></div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
            <div class="text-[var(--ds-text-muted)] text-[10px]">Estimado por Open-Meteo, no observado directamente</div>
          </div>`
        )
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
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

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
    <div className="w-full h-full relative bg-ds-canvas">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Selector de basemap: vidrio, consistente con el toggle 2D/3D. Se
          posiciona debajo de los controles de zoom/brújula (top-right) para
          no colisionar, y por encima del botón 2D/3D que vive en page.tsx. */}
      <div className="absolute top-44 right-4 z-10">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Cambiar mapa base"
          aria-expanded={pickerOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] border [border-color:var(--ds-glass-border)] rounded-ds-control text-xs font-semibold text-ds-text-primary hover:[background:var(--ds-glass-bg-elevated)] transition-[background-color] duration-ds-fast active:scale-[0.97] shadow-[var(--ds-shadow-glass-sm)]"
        >
          <MorphIcon icon={Layers} size={14} reducedMotion="user" />
          {BASEMAP_LABELS[basemap]}
        </button>

        {pickerOpen && (
          <>
            <button
              aria-label="Cerrar selector de mapa base"
              className="fixed inset-0 z-0 cursor-default"
              onClick={() => setPickerOpen(false)}
            />
            <div className="absolute right-0 mt-2 min-w-[9rem] z-10 [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] border [border-color:var(--ds-glass-border)] rounded-ds-control shadow-[var(--ds-shadow-glass-md)] p-1 flex flex-col gap-0.5">
              {BASEMAP_ORDER.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setBasemap(option);
                    setPickerOpen(false);
                  }}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-ds-lg text-xs font-medium text-ds-text-primary hover:[background:var(--ds-glass-bg-elevated)] transition-[background-color] duration-ds-fast text-left"
                >
                  <span>{BASEMAP_LABELS[option]}</span>
                  {option === basemap && (
                    <MorphIcon icon={Check} size={13} reducedMotion="user" className="text-brand-400" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
