'use client';

import React, { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { EarthquakeGeoJSON, AirQualityGeoJSON, EarthquakeProperties, AirQualityProperties } from "@/lib/types";

interface MapContainerProps {
  earthquakes: EarthquakeGeoJSON;
  airQuality: AirQualityGeoJSON;
  showQuakes: boolean;
  showAirQuality: boolean;
}

const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

export default function MapContainer({
  earthquakes,
  airQuality,
  showQuakes,
  showAirQuality,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef<boolean>(false);

  // 1. Inicialización única del mapa (Previene memory leaks y pérdida de contexto WebGL)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_DARK_STYLE,
      center: [-86.2362, 12.1150], // Managua / Centroamérica
      zoom: 3.5,
      pitch: 0,
      canvasContextAttributes: { antialias: true },
      maxPitch: 60,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

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

      // Popup de interacción con Sismos
      map.on("click", "earthquakes-layer", (e) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        if (feature.geometry.type !== "Point") return;
        const coordinates = feature.geometry.coordinates.slice();
        const { mag, place, time } = feature.properties as EarthquakeProperties;
        const dateStr = new Date(Number(time)).toLocaleString();

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

      // Efecto cursor pointer
      map.on("mouseenter", "earthquakes-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "earthquakes-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "air-quality-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "air-quality-layer", () => { map.getCanvas().style.cursor = ""; });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialización única e intencional; los updates posteriores de earthquakes/airQuality/showQuakes/showAirQuality se manejan en los effects de abajo vía setData/setLayoutProperty sin re-crear el mapa.
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

  return <div ref={mapContainerRef} className="w-full h-screen relative bg-slate-950" />;
}
