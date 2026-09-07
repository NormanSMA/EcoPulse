'use client';

import React, { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON, IssGeoJSON, VolcanoGeoJSON, AirQualityModelGeoJSON, EarthquakeProperties, AirQualityProperties, FireProperties, WeatherProperties, DisasterProperties, IssProperties, VolcanoProperties, AirQualityModelProperties } from "@/lib/types";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";

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
}

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

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
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);
  const onSelectEarthquakeRef = useRef(onSelectEarthquake);
  onSelectEarthquakeRef.current = onSelectEarthquake;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  // 1. Inicialización única del mapa (Previene memory leaks y pérdida de contexto WebGL)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_DARK_STYLE,
      center: [initialView.lng, initialView.lat],
      zoom: initialView.zoom,
      pitch: 0,
      canvasContextAttributes: { antialias: true },
      maxPitch: 60,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("moveend", () => {
      const center = map.getCenter();
      onViewChangeRef.current?.({ lng: center.lng, lat: center.lat, zoom: map.getZoom() });
    });

    map.on("load", () => {
      isMapLoadedRef.current = true;

      // Fuente y capa para Sismos (USGS)
      map.addSource("earthquakes-source", {
        type: "geojson",
        data: earthquakes,
      });

      map.addLayer({
        id: "earthquakes-layer",
        type: "circle",
        source: "earthquakes-source",
        layout: {
          visibility: showQuakes ? "visible" : "none",
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
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Fuente y capa para Calidad del Aire (OpenAQ)
      map.addSource("air-quality-source", {
        type: "geojson",
        data: airQuality,
      });

      map.addLayer({
        id: "air-quality-layer",
        type: "circle",
        source: "air-quality-source",
        layout: {
          visibility: showAirQuality ? "visible" : "none",
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
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0f172a",
        },
      });

      // Fuente y capa para Incendios (NASA FIRMS)
      map.addSource("fires-source", {
        type: "geojson",
        data: fires,
      });

      map.addLayer({
        id: "fires-layer",
        type: "circle",
        source: "fires-source",
        layout: {
          visibility: showFires ? "visible" : "none",
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
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fde047",
        },
      });

      // Fuente y capa para Clima (Open-Meteo) - etiqueta de texto, no circulo,
      // para no tapar los puntos de calidad de aire en las mismas ciudades
      map.addSource("weather-source", {
        type: "geojson",
        data: weather,
      });

      map.addLayer({
        id: "weather-layer",
        type: "symbol",
        source: "weather-source",
        layout: {
          visibility: showWeather ? "visible" : "none",
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
          "text-halo-width": 1.5,
        },
      });

      // Fuente y capa para Desastres Globales (GDACS: inundaciones, ciclones,
      // sequias, volcanes - EQ y WF se excluyen para no duplicar USGS/FIRMS)
      map.addSource("disasters-source", {
        type: "geojson",
        data: disasters,
      });

      map.addLayer({
        id: "disasters-layer",
        type: "circle",
        source: "disasters-source",
        layout: {
          visibility: showDisasters ? "visible" : "none",
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
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Fuente y capa para la ISS (posicion interpolada de la trayectoria OEM de NASA)
      map.addSource("iss-source", {
        type: "geojson",
        data: iss,
      });

      map.addLayer({
        id: "iss-layer",
        type: "circle",
        source: "iss-source",
        layout: {
          visibility: showIss ? "visible" : "none",
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
          visibility: showIss ? "visible" : "none",
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
          "text-halo-width": 1.5,
        },
      });

      // Fuente y capa para Volcanes (Smithsonian GVP - catalogo estatico de
      // volcanes del Holoceno; distinto de "VO" en GDACS, que son erupciones
      // activas). Poll diario, casi no cambia.
      map.addSource("volcanoes-source", {
        type: "geojson",
        data: volcanoes,
      });

      map.addLayer({
        id: "volcanoes-layer",
        type: "circle",
        source: "volcanoes-source",
        layout: {
          visibility: showVolcanoes ? "visible" : "none",
        },
        paint: {
          "circle-radius": 5,
          "circle-color": "#a16207",
          "circle-opacity": 0.75,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fef3c7",
        },
      });

      // Fuente y capa para Calidad del Aire Modelada (Open-Meteo) - anillo
      // hueco en las mismas coordenadas del AQ observado, para comparar
      // visualmente "relleno" (observado) vs "contorno" (modelo)
      map.addSource("air-quality-model-source", {
        type: "geojson",
        data: airQualityModel,
      });

      map.addLayer({
        id: "air-quality-model-layer",
        type: "circle",
        source: "air-quality-model-source",
        layout: {
          visibility: showAirQualityModel ? "visible" : "none",
        },
        paint: {
          "circle-radius": 11,
          // Casi transparente en vez de "transparent" (alpha 0): con alfa
          // cero MapLibre no detecta clicks dentro del circulo, solo en el
          // borde/stroke - confirmado interactivamente en el navegador.
          "circle-color": "rgba(0,0,0,0.01)",
          "circle-stroke-width": 2,
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
        const { mag, place, time } = feature.properties as EarthquakeProperties;
        const dateStr = new Date(Number(time)).toLocaleString();

        if (feature.id != null) onSelectEarthquakeRef.current?.(String(feature.id));

        new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(
            `<div class="space-y-1.5 p-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-rose-400 text-sm">Sismo M ${mag ?? 'N/D'}</span>
                <span class="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">USGS</span>
              </div>
              <div class="text-slate-200 font-medium leading-snug">${place}</div>
              <div class="text-slate-400 text-[10px]">Profundidad: ${coordinates[2] ?? 0} km</div>
              <div class="text-slate-400 text-[10px]">${dateStr}</div>
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
        const { station, pm25, category } = feature.properties as AirQualityProperties;

        new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(
            `<div class="space-y-1.5 p-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-emerald-400 text-sm">Calidad del Aire</span>
                <span class="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">${category}</span>
              </div>
              <div class="text-slate-200 font-medium">${station}</div>
              <div class="text-slate-300">PM2.5: <span class="font-bold text-white">${pm25} µg/m³</span></div>
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
              <div class="text-slate-300">FRP: <span class="font-bold text-white">${frp} MW</span></div>
              <div class="text-slate-400 text-[10px]">Confianza: ${confidence}</div>
              <div class="text-slate-400 text-[10px]">${dateStr}</div>
            </div>`
          )
          .addTo(map);
      });

      // Popup de interacción con Clima
      map.on("click", "weather-layer", (e) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (feature.geometry.type !== "Point") return;
        const coordinates = feature.geometry.coordinates.slice();
        const { city, temperature, humidity, windSpeed, weatherDescription } = feature.properties as WeatherProperties;

        new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(
            `<div class="space-y-1.5 p-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-sky-400 text-sm">${city}</span>
                <span class="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">${weatherDescription}</span>
              </div>
              <div class="text-slate-300">Temperatura: <span class="font-bold text-white">${temperature}°C</span></div>
              <div class="text-slate-400 text-[10px]">Humedad: ${humidity}% · Viento: ${windSpeed} km/h</div>
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
        const { name, eventTypeLabel, country, alertLevel, reportUrl } = feature.properties as DisasterProperties;

        new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(
            `<div class="space-y-1.5 p-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-amber-400 text-sm">${eventTypeLabel}</span>
                <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${alertLevel === 'Red' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}">${alertLevel}</span>
              </div>
              <div class="text-slate-200 font-medium leading-snug">${name}</div>
              <div class="text-slate-400 text-[10px]">${country}</div>
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
                <span class="font-bold text-slate-200 text-sm">🛰️ Estación Espacial Internacional</span>
              </div>
              <div class="text-slate-300">Altitud: <span class="font-bold text-white">${altitudeKm.toFixed(1)} km</span></div>
              <div class="text-slate-300">Velocidad: <span class="font-bold text-white">${velocityKmS.toFixed(2)} km/s</span></div>
              <div class="text-slate-400 text-[10px]">${dateStr}</div>
            </div>`
          )
          .addTo(map);
      });

      // Popup de interacción con Volcanes
      map.on("click", "volcanoes-layer", (e) => {
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
              <div class="text-slate-200 font-medium">${country}</div>
              <div class="text-slate-400 text-[10px]">Última erupción: ${eruptionText}</div>
              <div class="text-slate-400 text-[10px]">Elevación: ${elevationM ?? "N/D"} m</div>
            </div>`
          )
          .addTo(map);
      });

      // Popup de interacción con Calidad del Aire Modelada
      map.on("click", "air-quality-model-layer", (e) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (feature.geometry.type !== "Point") return;
        const coordinates = feature.geometry.coordinates.slice();
        const { city, pm25, category } = feature.properties as AirQualityModelProperties;

        new maplibregl.Popup({ closeButton: true, focusAfterOpen: false })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(
            `<div class="space-y-1.5 p-1 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-cyan-400 text-sm">Aire (modelo)</span>
                <span class="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded">${category}</span>
              </div>
              <div class="text-slate-200 font-medium">${city}</div>
              <div class="text-slate-300">PM2.5: <span class="font-bold text-white">${pm25} µg/m³</span></div>
              <div class="text-slate-400 text-[10px]">Estimado por Open-Meteo, no observado directamente</div>
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
      map.on("mouseenter", "weather-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "weather-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "disasters-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "disasters-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "iss-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "iss-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "volcanoes-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "volcanoes-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "air-quality-model-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "air-quality-model-layer", () => { map.getCanvas().style.cursor = ""; });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialización única e intencional; los updates posteriores de earthquakes/airQuality/fires/weather/disasters/iss/volcanoes/airQualityModel/showQuakes/showAirQuality/showFires/showWeather/showDisasters/showIss/showVolcanoes/showAirQualityModel se manejan en los effects de abajo vía setData/setLayoutProperty sin re-crear el mapa.
  }, []);

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
  }, [showVolcanoes]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    if (mapRef.current.getLayer("air-quality-model-layer")) {
      mapRef.current.setLayoutProperty("air-quality-model-layer", "visibility", showAirQualityModel ? "visible" : "none");
    }
  }, [showAirQualityModel]);

  return <div ref={mapContainerRef} className="w-full h-full relative bg-slate-950" />;
}
