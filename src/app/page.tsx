'use client';

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/ui/Header";
import StatsPanel from "@/components/ui/StatsPanel";
import NearbySearch from "@/components/ui/NearbySearch";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON } from "@/lib/types";
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

const INITIAL_AIR_QUALITY: AirQualityGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const INITIAL_FIRES: FireGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const INITIAL_WEATHER: WeatherGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const INITIAL_DISASTERS: DisasterGeoJSON = {
  type: "FeatureCollection",
  features: []
};

export default function HomePage() {
  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(INITIAL_EARTHQUAKES);
  const [airQuality, setAirQuality] = useState<AirQualityGeoJSON>(INITIAL_AIR_QUALITY);
  const [fires, setFires] = useState<FireGeoJSON>(INITIAL_FIRES);
  const [weather, setWeather] = useState<WeatherGeoJSON>(INITIAL_WEATHER);
  const [disasters, setDisasters] = useState<DisasterGeoJSON>(INITIAL_DISASTERS);
  const [showQuakes, setShowQuakes] = useState<boolean>(true);
  const [showAirQuality, setShowAirQuality] = useState<boolean>(true);
  const [showFires, setShowFires] = useState<boolean>(true);
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [showDisasters, setShowDisasters] = useState<boolean>(true);

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

    async function loadAirQuality() {
      try {
        const res = await fetch("/api/air-quality", { signal: controller.signal });
        if (!res.ok) throw new Error(`Air quality HTTP ${res.status}`);
        const data: AirQualityGeoJSON = await res.json();
        setAirQuality(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con OpenAQ:", err);
        }
      }
    }

    async function loadFires() {
      try {
        const res = await fetch("/api/fires", { signal: controller.signal });
        if (!res.ok) throw new Error(`Fires HTTP ${res.status}`);
        const data: FireGeoJSON = await res.json();
        setFires(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con NASA FIRMS:", err);
        }
      }
    }

    async function loadWeather() {
      try {
        const res = await fetch("/api/weather", { signal: controller.signal });
        if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
        const data: WeatherGeoJSON = await res.json();
        setWeather(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con Open-Meteo:", err);
        }
      }
    }

    async function loadDisasters() {
      try {
        const res = await fetch("/api/disasters", { signal: controller.signal });
        if (!res.ok) throw new Error(`Disasters HTTP ${res.status}`);
        const data: DisasterGeoJSON = await res.json();
        setDisasters(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con GDACS:", err);
        }
      }
    }

    loadData();
    loadAirQuality();
    loadFires();
    loadWeather();
    loadDisasters();
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
        showFires={showFires}
        setShowFires={setShowFires}
        showWeather={showWeather}
        setShowWeather={setShowWeather}
        showDisasters={showDisasters}
        setShowDisasters={setShowDisasters}
      />
      <NearbySearch />
      <MapContainer
        earthquakes={earthquakes}
        airQuality={airQuality}
        fires={fires}
        weather={weather}
        disasters={disasters}
        showQuakes={showQuakes}
        showAirQuality={showAirQuality}
        showFires={showFires}
        showWeather={showWeather}
        showDisasters={showDisasters}
      />
    </main>
  );
}
