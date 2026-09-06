'use client';

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/ui/Header";
import StatsPanel from "@/components/ui/StatsPanel";
import { EarthquakeGeoJSON, AirQualityGeoJSON } from "@/lib/types";
import { mockAirQualityGeoJSON } from "@/lib/openaq";
import { fetchLiveEarthquakes } from "@/lib/usgs";

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      <p className="text-xs font-medium tracking-wide">Inicializando motor de renderizado WebGL...</p>
    </div>
  ),
});

const INITIAL_EARTHQUAKES: EarthquakeGeoJSON = {
  type: "FeatureCollection",
  metadata: { generated: Date.now(), url: "", title: "", status: 200, api: "1", count: 0 },
  features: []
};

export default function HomePage() {
  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(INITIAL_EARTHQUAKES);
  const [airQuality] = useState<AirQualityGeoJSON>(mockAirQualityGeoJSON());
  const [showQuakes, setShowQuakes] = useState<boolean>(true);
  const [showAirQuality, setShowAirQuality] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const data = await fetchLiveEarthquakes(controller.signal);
        setEarthquakes(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con feed USGS:", err);
        }
      }
    }

    loadData();
    return () => controller.abort();
  }, []);

  const maxMag = useMemo(() => {
    if (!earthquakes.features.length) return 0;
    return earthquakes.features.reduce((max, f) => {
      const mag = f.properties.mag ?? 0;
      return mag > max ? mag : max;
    }, 0);
  }, [earthquakes]);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950">
      <Header earthquakeCount={earthquakes.features.length} maxMag={maxMag} />
      <StatsPanel
        showQuakes={showQuakes}
        setShowQuakes={setShowQuakes}
        showAirQuality={showAirQuality}
        setShowAirQuality={setShowAirQuality}
      />
      <MapContainer
        earthquakes={earthquakes}
        airQuality={airQuality}
        showQuakes={showQuakes}
        showAirQuality={showAirQuality}
      />
    </main>
  );
}
