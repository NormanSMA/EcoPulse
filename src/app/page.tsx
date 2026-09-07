'use client';

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Inbox, Waves, Flame, AlertTriangle } from "lucide";
import { I18nProvider } from "@/design-system/i18n/I18nProvider";
import { getFreshness, useTheme } from "@/design-system/hooks";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { Globe2, Map as MapIcon } from "lucide";
import { MorphIcon } from "morphicons/react";
import Header from "@/components/ui/Header";
import StatsPanel from "@/components/ui/StatsPanel";
import NearbySearch from "@/components/ui/NearbySearch";
import { Card } from "@/components/ui/Card";
import { EventList, type EventListItem } from "@/components/ui/EventList";
import { TimeControl, type TimeWindow } from "@/components/ui/TimeControl";
import { TrendChart } from "@/components/ui/TrendChart";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON, IssGeoJSON, VolcanoGeoJSON, AirQualityModelGeoJSON } from "@/lib/types";
import { fetchLiveEarthquakes } from "@/lib/usgs";

const MAP_LOADING = (
  <div className="w-full h-full flex flex-col items-center justify-center bg-ds-canvas text-slate-400 gap-3">
    <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    <p className="text-xs font-medium tracking-wide">Inicializando motor de renderizado WebGL...</p>
  </div>
);

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => MAP_LOADING,
});

const GlobeContainer = dynamic(() => import("@/components/map/GlobeContainer"), {
  ssr: false,
  loading: () => MAP_LOADING,
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

const INITIAL_ISS: IssGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const INITIAL_VOLCANOES: VolcanoGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const INITIAL_AIR_QUALITY_MODEL: AirQualityModelGeoJSON = {
  type: "FeatureCollection",
  features: []
};

const ISS_REFRESH_MS = 15000;

function HomePageContent() {
  const t = useTranslations("events");
  const tKinds = useTranslations("events.kinds");

  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(INITIAL_EARTHQUAKES);
  const [airQuality, setAirQuality] = useState<AirQualityGeoJSON>(INITIAL_AIR_QUALITY);
  const [fires, setFires] = useState<FireGeoJSON>(INITIAL_FIRES);
  const [weather, setWeather] = useState<WeatherGeoJSON>(INITIAL_WEATHER);
  const [disasters, setDisasters] = useState<DisasterGeoJSON>(INITIAL_DISASTERS);
  const [iss, setIss] = useState<IssGeoJSON>(INITIAL_ISS);
  const [volcanoes, setVolcanoes] = useState<VolcanoGeoJSON>(INITIAL_VOLCANOES);
  const [airQualityModel, setAirQualityModel] = useState<AirQualityModelGeoJSON>(INITIAL_AIR_QUALITY_MODEL);
  const [showQuakes, setShowQuakes] = useState<boolean>(true);
  const [showAirQuality, setShowAirQuality] = useState<boolean>(true);
  const [showFires, setShowFires] = useState<boolean>(true);
  const [showWeather, setShowWeather] = useState<boolean>(true);
  const [showDisasters, setShowDisasters] = useState<boolean>(true);
  const [showIss, setShowIss] = useState<boolean>(true);
  const [showVolcanoes, setShowVolcanoes] = useState<boolean>(true);
  const [showAirQualityModel, setShowAirQualityModel] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("live");
  const [playing, setPlaying] = useState(false);
  const [selectedQuakeId, setSelectedQuakeId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [mapView, setMapView] = useState<MapView>(DEFAULT_MAP_VIEW);
  const { theme } = useTheme();
  const [mobileSheet, setMobileSheet] = useState<"layers" | "events" | null>(null);

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

    async function loadVolcanoes() {
      try {
        const res = await fetch("/api/volcanoes", { signal: controller.signal });
        if (!res.ok) throw new Error(`Volcanoes HTTP ${res.status}`);
        const data: VolcanoGeoJSON = await res.json();
        setVolcanoes(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con Smithsonian GVP:", err);
        }
      }
    }

    async function loadAirQualityModel() {
      try {
        const res = await fetch("/api/air-quality-model", { signal: controller.signal });
        if (!res.ok) throw new Error(`Air quality model HTTP ${res.status}`);
        const data: AirQualityModelGeoJSON = await res.json();
        setAirQualityModel(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con el modelo de aire de Open-Meteo:", err);
        }
      }
    }

    loadData();
    loadAirQuality();
    loadFires();
    loadWeather();
    loadDisasters();
    loadVolcanoes();
    loadAirQualityModel();
    return () => controller.abort();
  }, []);

  // La ISS viaja a ~7.7 km/s: refrescar solo al cargar la pagina la dejaria
  // desactualizada en segundos. Se sondea por separado con un intervalo corto.
  useEffect(() => {
    const controller = new AbortController();

    async function loadIss() {
      try {
        const res = await fetch("/api/iss", { signal: controller.signal });
        if (!res.ok) throw new Error(`ISS HTTP ${res.status}`);
        const data: IssGeoJSON = await res.json();
        setIss(data);
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al sincronizar con la posición de la ISS:", err);
        }
      }
    }

    loadIss();
    const interval = setInterval(loadIss, ISS_REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  // Búsqueda: filtra sismos por lugar. Solo UI/cliente sobre datos ya
  // obtenidos — no toca la ingesta ni pega de nuevo a USGS.
  const filteredEarthquakes = useMemo<EarthquakeGeoJSON>(() => {
    if (!searchQuery.trim()) return earthquakes;
    const q = searchQuery.trim().toLowerCase();
    return {
      ...earthquakes,
      features: earthquakes.features.filter((f) => f.properties.place?.toLowerCase().includes(q)),
    };
  }, [earthquakes, searchQuery]);

  const maxMag = useMemo(() => {
    if (!filteredEarthquakes.features.length) return 0;
    return filteredEarthquakes.features.reduce((max, f) => {
      const mag = f.properties.mag ?? 0;
      return mag > max ? mag : max;
    }, 0);
  }, [filteredEarthquakes]);

  // Fase 3.2: EventList combina sismos/incendios/desastres ya obtenidos en
  // una sola lista ordenada por recencia — presentacional, no agrega
  // ninguna fuente ni campo nuevo a src/lib/types.ts.
  const eventItems = useMemo<EventListItem[]>(() => {
    type RankedItem = EventListItem & { ts: number };

    const quakeItems: RankedItem[] = filteredEarthquakes.features.map((f) => ({
      id: `eq-${f.id}`,
      icon: Waves,
      iconClassName: "text-rose-400",
      title: `M ${f.properties.mag?.toFixed(1) ?? "?"} — ${f.properties.place}`,
      description: tKinds("earthquake"),
      timestamp: new Date(f.properties.time).toLocaleString(),
      status: getFreshness(f.properties.time),
      onClick: () => setSelectedQuakeId(String(f.id)),
      ts: f.properties.time,
    }));

    const fireItems: RankedItem[] = fires.features.map((f) => {
      const ts = new Date(f.properties.acquiredAt).getTime();
      return {
        id: `fire-${f.id}`,
        icon: Flame,
        iconClassName: "text-amber-400",
        title: `${tKinds("fire")} · FRP ${f.properties.frp.toFixed(1)}`,
        description: f.properties.satellite,
        timestamp: new Date(f.properties.acquiredAt).toLocaleString(),
        status: getFreshness(ts, { live: 180, recent: 720 }),
        ts,
      };
    });

    const disasterItems: RankedItem[] = disasters.features.map((f) => {
      const ts = f.properties.fromDate ? new Date(f.properties.fromDate).getTime() : 0;
      return {
        id: `disaster-${f.id}`,
        icon: AlertTriangle,
        iconClassName: "text-orange-400",
        title: `${f.properties.eventTypeLabel} — ${f.properties.name}`,
        description: f.properties.country,
        timestamp: f.properties.fromDate ? new Date(f.properties.fromDate).toLocaleString() : "",
        status: getFreshness(ts || null, { live: 1440, recent: 10080 }),
        ts,
      };
    });

    return [...quakeItems, ...fireItems, ...disasterItems]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map((item): EventListItem => {
        const { ts: _rank, ...rest } = item;
        void _rank;
        return rest;
      });
  }, [filteredEarthquakes, fires, disasters, tKinds]);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-ds-canvas flex flex-col">
      <Header
        earthquakeCount={filteredEarthquakes.features.length}
        maxMag={maxMag}
        generatedAt={earthquakes.metadata.generated || null}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="hidden lg:flex lg:flex-col w-80 shrink-0 gap-3 overflow-y-auto p-3 border-r [border-color:var(--ds-glass-border)]">
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
            showIss={showIss}
            setShowIss={setShowIss}
            showVolcanoes={showVolcanoes}
            setShowVolcanoes={setShowVolcanoes}
            showAirQualityModel={showAirQualityModel}
            setShowAirQualityModel={setShowAirQualityModel}
          />
          <NearbySearch />
        </aside>

        <div className="flex-1 relative">
          {mapMode === "2d" ? (
            <MapContainer
              earthquakes={filteredEarthquakes}
              airQuality={airQuality}
              fires={fires}
              weather={weather}
              disasters={disasters}
              iss={iss}
              volcanoes={volcanoes}
              airQualityModel={airQualityModel}
              showQuakes={showQuakes}
              showAirQuality={showAirQuality}
              showFires={showFires}
              showWeather={showWeather}
              showDisasters={showDisasters}
              showIss={showIss}
              showVolcanoes={showVolcanoes}
              showAirQualityModel={showAirQualityModel}
              onSelectEarthquake={setSelectedQuakeId}
              onViewChange={setMapView}
              initialView={mapView}
              theme={theme}
            />
          ) : (
            <GlobeContainer
              earthquakes={filteredEarthquakes}
              airQuality={airQuality}
              fires={fires}
              weather={weather}
              disasters={disasters}
              iss={iss}
              volcanoes={volcanoes}
              airQualityModel={airQualityModel}
              showQuakes={showQuakes}
              showAirQuality={showAirQuality}
              showFires={showFires}
              showWeather={showWeather}
              showDisasters={showDisasters}
              showIss={showIss}
              showVolcanoes={showVolcanoes}
              showAirQualityModel={showAirQualityModel}
              onSelectEarthquake={setSelectedQuakeId}
              selectedEarthquakeId={selectedQuakeId}
              initialView={mapView}
              theme={theme}
            />
          )}

          <button
            onClick={() => setMapMode((m) => (m === "2d" ? "3d" : "2d"))}
            className="absolute top-32 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] border [border-color:var(--ds-glass-border)] rounded-ds-control text-xs font-semibold text-ds-text-primary hover:[background:var(--ds-glass-bg-elevated)] transition-[background-color] duration-ds-fast active:scale-[0.97] shadow-[var(--ds-shadow-glass-sm)]"
          >
            <MorphIcon icon={mapMode === "2d" ? Globe2 : MapIcon} size={14} reducedMotion="user" />
            {mapMode === "2d" ? "3D" : "2D"}
          </button>

          {/* Accesos móviles/tablet: los paneles laterales se ocultan por debajo de lg y
              se abren como bottom sheet de vidrio (ver aside inferior fixed). */}
          <div className="lg:hidden absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <button
              onClick={() => setMobileSheet((s) => (s === "layers" ? null : "layers"))}
              aria-label={t("title")}
              className="h-11 w-11 flex items-center justify-center rounded-ds-full [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] border [border-color:var(--ds-glass-border)] text-ds-text-primary shadow-[var(--ds-shadow-glass-md)] active:scale-95 transition-transform"
            >
              <MorphIcon icon={MapIcon} size={18} reducedMotion="user" />
            </button>
            <button
              onClick={() => setMobileSheet((s) => (s === "events" ? null : "events"))}
              aria-label={t("title")}
              className="h-11 w-11 flex items-center justify-center rounded-ds-full [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] border [border-color:var(--ds-glass-border)] text-ds-text-primary shadow-[var(--ds-shadow-glass-md)] active:scale-95 transition-transform"
            >
              <MorphIcon icon={Inbox} size={18} reducedMotion="user" />
            </button>
          </div>
        </div>

        <aside className="hidden lg:flex lg:flex-col w-80 shrink-0 gap-3 overflow-hidden p-3 border-l [border-color:var(--ds-glass-border)]">
          <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ds-text-secondary pb-2 border-b [border-color:var(--ds-glass-border)] mb-2">
              <span>{t("title")}</span>
            </div>
            <EventList
              items={eventItems}
              emptyIcon={Inbox}
              emptyTitle={t("empty")}
              emptyDescription={t("emptyDescription")}
              className="flex-1"
            />
          </Card>

          <Card className="shrink-0" style={{ height: 200 }}>
            <TrendChart
              earthquakes={earthquakes}
              selectedEarthquakeId={selectedQuakeId}
              className="h-full"
            />
          </Card>
        </aside>

        {/* Bottom sheet móvil/tablet: mismo contenido que los asides de escritorio,
            en un panel de vidrio anclado abajo con scrim para cerrar al tocar fuera. */}
        {mobileSheet && (
          <div className="lg:hidden absolute inset-0 z-20 flex items-end">
            <button
              aria-label="Cerrar"
              onClick={() => setMobileSheet(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <div
              className="relative w-full max-h-[70vh] overflow-y-auto rounded-t-ds-panel border-t [border-color:var(--ds-glass-border)] [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))] shadow-[var(--ds-shadow-glass-lg)] p-4 pb-6"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ds-text-muted/40" />
              {mobileSheet === "layers" ? (
                <div className="space-y-3">
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
                    showIss={showIss}
                    setShowIss={setShowIss}
                    showVolcanoes={showVolcanoes}
                    setShowVolcanoes={setShowVolcanoes}
                    showAirQualityModel={showAirQualityModel}
                    setShowAirQualityModel={setShowAirQualityModel}
                    className="border-0 shadow-none [background:transparent] backdrop-blur-none p-0"
                  />
                  <NearbySearch />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ds-text-secondary">
                    <span>{t("title")}</span>
                  </div>
                  <EventList
                    items={eventItems}
                    emptyIcon={Inbox}
                    emptyTitle={t("empty")}
                    emptyDescription={t("emptyDescription")}
                    className="max-h-[40vh]"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <TimeControl
        window={timeWindow}
        onWindowChange={setTimeWindow}
        playing={playing}
        onTogglePlayback={() => setPlaying((p) => !p)}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <I18nProvider>
      <HomePageContent />
    </I18nProvider>
  );
}
