'use client';

import { useState, useEffect, useMemo, useCallback, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Inbox, Waves, Flame, AlertTriangle, Radio, Activity, SlidersHorizontal, X, ChartSpline } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { I18nProvider, useLocale } from "@/design-system/i18n/I18nProvider";
import { getFreshness, useFreshness, useTheme, useBasemap } from "@/design-system/hooks";
import { layers, magnitudeColor, alertColor, type LayerKey } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import Header, { type MapMode } from "@/components/ui/Header";
import ControlsPanel, { type LayerVisibility } from "@/components/ui/ControlsPanel";
import { Button, IconButton } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EventList, type EventListItem } from "@/components/ui/EventList";
import { TimeControl, type TimeWindow } from "@/components/ui/TimeControl";
import { TrendChart } from "@/components/ui/TrendChart";
import { Legend } from "@/components/ui/Legend";
import { EarthquakeGeoJSON, AirQualityGeoJSON, FireGeoJSON, WeatherGeoJSON, DisasterGeoJSON, IssGeoJSON, VolcanoGeoJSON, AirQualityModelGeoJSON } from "@/lib/types";
import { fetchLiveEarthquakes } from "@/lib/usgs";
import { setPopupLocale } from "@/lib/popupHtml";

const MAP_LOADING = (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ds-canvas text-ds-text-secondary">
    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ds-surface-highest border-t-ds-primary" />
    <p className="text-sm">Inicializando motor de renderizado WebGL…</p>
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

const HOUR_MS = 3_600_000;
const WINDOW_MS: Record<TimeWindow, number | null> = {
  live: null,
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
};
const PLAYBACK_DURATION_MS = 20_000;
const PLAYBACK_TICK_MS = 100;

const INITIAL_VISIBILITY: LayerVisibility = {
  earthquakes: true,
  airQuality: true,
  fires: true,
  weather: true,
  disasters: true,
  iss: true,
  volcanoes: true,
  airQualityModel: false,
};

/** Cabecera de panel flotante: título + cerrar (como "Controls ✕" de Weather Lab). */
function PanelHeader({
  title,
  icon,
  meta,
  onClose,
  closeLabel,
  autoFocusClose,
}: {
  title: string;
  icon: IconNode;
  meta?: ReactNode;
  onClose: () => void;
  closeLabel: string;
  autoFocusClose?: boolean;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-ds-outline-variant pl-5 pr-3">
      <MorphIcon icon={icon} size={20} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
      <h2 className="min-w-0 flex-1 truncate text-lg font-medium text-ds-text-primary">{title}</h2>
      {meta}
      <IconButton aria-label={closeLabel} onClick={onClose} autoFocus={autoFocusClose}>
        <MorphIcon icon={X} size={20} reducedMotion="user" />
      </IconButton>
    </div>
  );
}

function HomePageContent() {
  const t = useTranslations("events");
  const tKinds = useTranslations("events.kinds");
  const tPanel = useTranslations("panel");
  const tMetrics = useTranslations("metrics");
  const tTime = useTranslations("timeControl");
  const { locale } = useLocale();

  const [earthquakes, setEarthquakes] = useState<EarthquakeGeoJSON>(INITIAL_EARTHQUAKES);
  const [airQuality, setAirQuality] = useState<AirQualityGeoJSON>(INITIAL_AIR_QUALITY);
  const [fires, setFires] = useState<FireGeoJSON>(INITIAL_FIRES);
  const [weather, setWeather] = useState<WeatherGeoJSON>(INITIAL_WEATHER);
  const [disasters, setDisasters] = useState<DisasterGeoJSON>(INITIAL_DISASTERS);
  const [iss, setIss] = useState<IssGeoJSON>(INITIAL_ISS);
  const [volcanoes, setVolcanoes] = useState<VolcanoGeoJSON>(INITIAL_VOLCANOES);
  const [airQualityModel, setAirQualityModel] = useState<AirQualityModelGeoJSON>(INITIAL_AIR_QUALITY_MODEL);
  const [visibility, setVisibility] = useState<LayerVisibility>(INITIAL_VISIBILITY);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("live");
  const [playing, setPlaying] = useState(false);
  const [selectedQuakeId, setSelectedQuakeId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [mapView, setMapView] = useState<MapView>(DEFAULT_MAP_VIEW);
  // Un solo useTheme() para toda la página: Header lo recibe por props, así
  // el basemap (que sigue al tema) y el globo se enteran del cambio.
  const { theme, toggleTheme } = useTheme();
  const { basemap, setBasemap } = useBasemap(theme);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState<"layers" | "events" | null>(null);

  const setLayer = useCallback((key: LayerKey, value: boolean) => {
    setVisibility((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!mobileSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSheet]);

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

  // ---------- Ventana temporal y reproducción ----------
  // "live" = todo lo disponible; 1h/6h/24h/7d filtran sismos, incendios y
  // desastres por su marca de tiempo. El feed diario de USGS solo cubre 24 h,
  // así que para 7d se pide aparte el feed semanal (una vez, bajo demanda).
  // La reproducción recorre la ventana (24 h si es "live") en ~20 s, mostrando
  // solo los eventos ocurridos hasta el cursor.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [weekQuakes, setWeekQuakes] = useState<EarthquakeGeoJSON | null>(null);
  useEffect(() => {
    if (timeWindow !== "7d" || weekQuakes) return;
    const controller = new AbortController();
    fetchLiveEarthquakes(controller.signal, "week")
      .then(setWeekQuakes)
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("Error al obtener el feed semanal de USGS:", err);
        }
      });
    return () => controller.abort();
  }, [timeWindow, weekQuakes]);

  const [playhead, setPlayhead] = useState<number | null>(null);
  const windowMs = WINDOW_MS[timeWindow];
  const span = windowMs ?? WINDOW_MS["24h"]!;

  useEffect(() => {
    if (!playing) return;
    const step = (span * PLAYBACK_TICK_MS) / PLAYBACK_DURATION_MS;
    setPlayhead((p) => p ?? Date.now() - span);
    const id = setInterval(() => setPlayhead((p) => (p ?? Date.now() - span) + step), PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [playing, span]);

  // Fin de la reproducción: vuelve al modo en vivo.
  useEffect(() => {
    if (playhead != null && playhead >= Date.now()) {
      setPlaying(false);
      setPlayhead(null);
    }
  }, [playhead]);

  const changeWindow = useCallback((w: TimeWindow) => {
    setTimeWindow(w);
    setPlaying(false);
    setPlayhead(null);
  }, []);

  const rangeStart = windowMs != null || playhead != null ? now - span : -Infinity;
  const rangeEnd = playhead ?? Infinity;
  const inRange = useCallback((ts: number) => ts >= rangeStart && ts <= rangeEnd, [rangeStart, rangeEnd]);
  const playProgress = playhead != null ? (playhead - (now - span)) / span : null;

  // ---------- Filtros (búsqueda + tiempo) ----------
  // Solo UI/cliente sobre datos ya obtenidos — no toca la ingesta.
  const baseEarthquakes = timeWindow === "7d" && weekQuakes ? weekQuakes : earthquakes;

  const filteredEarthquakes = useMemo<EarthquakeGeoJSON>(() => {
    const q = searchQuery.trim().toLowerCase();
    return {
      ...baseEarthquakes,
      features: baseEarthquakes.features.filter(
        (f) => inRange(f.properties.time) && (!q || f.properties.place?.toLowerCase().includes(q))
      ),
    };
  }, [baseEarthquakes, searchQuery, inRange]);

  const filteredFires = useMemo<FireGeoJSON>(
    () => ({ ...fires, features: fires.features.filter((f) => inRange(new Date(f.properties.acquiredAt).getTime())) }),
    [fires, inRange]
  );

  const filteredDisasters = useMemo<DisasterGeoJSON>(
    () => ({
      ...disasters,
      features: disasters.features.filter((f) =>
        f.properties.fromDate ? inRange(new Date(f.properties.fromDate).getTime()) : rangeStart === -Infinity
      ),
    }),
    [disasters, inRange, rangeStart]
  );

  const maxMag = useMemo(() => {
    if (!filteredEarthquakes.features.length) return 0;
    return filteredEarthquakes.features.reduce((max, f) => {
      const mag = f.properties.mag ?? 0;
      return mag > max ? mag : max;
    }, 0);
  }, [filteredEarthquakes]);

  const generatedAt = earthquakes.metadata.generated || null;
  const feedStatus = useFreshness(generatedAt);

  // Centrar el mapa/globo en un evento (desde la lista).
  const [focus, setFocus] = useState<{ lng: number; lat: number; key: number } | null>(null);
  const focusOn = useCallback((lng: number, lat: number) => {
    setFocus({ lng, lat, key: Date.now() });
    setMobileSheet(null);
  }, []);
  const changeMapMode = useCallback((mode: MapMode) => {
    setFocus(null);
    setMapMode(mode);
  }, []);

  // Idioma de los popups (HTML fuera del árbol de React).
  useEffect(() => {
    setPopupLocale(locale);
  }, [locale]);

  // Lista combinada de sismos/incendios/desastres ordenada por recencia.
  // Respeta la visibilidad de capas y los filtros de búsqueda/tiempo.
  const eventItems = useMemo<EventListItem[]>(() => {
    type RankedItem = EventListItem & { ts: number };

    const quakeItems: RankedItem[] = !visibility.earthquakes
      ? []
      : filteredEarthquakes.features.map((f) => ({
          id: `eq-${f.id}`,
          icon: Waves,
          color: magnitudeColor(f.properties.mag ?? 0),
          title: `M ${f.properties.mag?.toFixed(1) ?? "?"} — ${f.properties.place}`,
          description: tKinds("earthquake"),
          timestamp: new Date(f.properties.time).toLocaleString(locale),
          status: getFreshness(f.properties.time),
          selected: String(f.id) === selectedQuakeId,
          onClick: () => {
            setSelectedQuakeId(String(f.id));
            focusOn(f.geometry.coordinates[0], f.geometry.coordinates[1]);
          },
          ts: f.properties.time,
        }));

    const fireItems: RankedItem[] = !visibility.fires
      ? []
      : filteredFires.features.map((f) => {
          const ts = new Date(f.properties.acquiredAt).getTime();
          return {
            id: `fire-${f.id}`,
            icon: Flame,
            color: layers.fires,
            title: `${tKinds("fire")} · FRP ${f.properties.frp.toFixed(1)}`,
            description: f.properties.satellite,
            timestamp: new Date(f.properties.acquiredAt).toLocaleString(locale),
            status: getFreshness(ts, { live: 180, recent: 720 }),
            onClick: () => focusOn(f.geometry.coordinates[0], f.geometry.coordinates[1]),
            ts,
          };
        });

    const disasterItems: RankedItem[] = !visibility.disasters
      ? []
      : filteredDisasters.features.map((f) => {
          const ts = f.properties.fromDate ? new Date(f.properties.fromDate).getTime() : 0;
          return {
            id: `disaster-${f.id}`,
            icon: AlertTriangle,
            color: alertColor(f.properties.alertLevel),
            title: `${f.properties.eventTypeLabel} — ${f.properties.name}`,
            description: f.properties.country,
            timestamp: f.properties.fromDate ? new Date(f.properties.fromDate).toLocaleString(locale) : "",
            status: getFreshness(ts || null, { live: 1440, recent: 10080 }),
            onClick: () => focusOn(f.geometry.coordinates[0], f.geometry.coordinates[1]),
            ts,
          };
        });

    // Dedupe por id: FIRMS puede traer filas casi duplicadas con el mismo id.
    const seen = new Set<string>();
    return [...quakeItems, ...fireItems, ...disasterItems]
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
      .map((item): EventListItem => {
        const { ts: _rank, ...rest } = item;
        void _rank;
        return rest;
      });
  }, [filteredEarthquakes, filteredFires, filteredDisasters, visibility, tKinds, locale, selectedQuakeId, focusOn]);

  // Total real (la lista solo muestra los 20 más recientes).
  const eventTotal =
    (visibility.earthquakes ? filteredEarthquakes.features.length : 0) +
    (visibility.fires ? filteredFires.features.length : 0) +
    (visibility.disasters ? filteredDisasters.features.length : 0);

  const mapProps = {
    earthquakes: filteredEarthquakes,
    airQuality,
    fires: filteredFires,
    weather,
    disasters: filteredDisasters,
    iss,
    volcanoes,
    airQualityModel,
    showQuakes: visibility.earthquakes,
    showAirQuality: visibility.airQuality,
    showFires: visibility.fires,
    showWeather: visibility.weather,
    showDisasters: visibility.disasters,
    showIss: visibility.iss,
    showVolcanoes: visibility.volcanoes,
    showAirQualityModel: visibility.airQualityModel,
    onSelectEarthquake: setSelectedQuakeId,
    initialView: mapView,
    focus,
  };

  const feedBadge = generatedAt != null ? <StatusBadge status={feedStatus} size="sm" /> : null;

  const metrics = (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        icon={Radio}
        iconColor={layers.earthquakes}
        label={tMetrics("earthquakes24h")}
        value={filteredEarthquakes.features.length}
      />
      <MetricCard
        icon={Activity}
        iconColor={magnitudeColor(maxMag)}
        label={tMetrics("maxMagnitude")}
        value={maxMag ? `M ${maxMag.toFixed(1)}` : "—"}
      />
    </div>
  );

  const eventList = (className?: string) => (
    <EventList
      items={eventItems}
      emptyIcon={Inbox}
      emptyTitle={t("empty")}
      emptyDescription={t("emptyDescription")}
      className={className}
    />
  );

  const trend = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 text-sm font-medium text-ds-text-primary">
        <MorphIcon icon={ChartSpline} size={18} reducedMotion="user" className="text-ds-text-secondary" />
        {t("trend.title")}
      </div>
      <TrendChart earthquakes={baseEarthquakes} selectedEarthquakeId={selectedQuakeId} className="h-40" />
    </div>
  );

  // Desplazamientos de los controles nativos del mapa (zoom, atribución,
  // créditos de Cesium) para que no queden debajo de los paneles flotantes
  // — ver .ep-map-stage en globals.css.
  const stageStyle = {
    "--ep-inset-right-lg": eventsOpen ? "372px" : "16px",
    "--ep-inset-top-lg": eventsOpen ? "16px" : "80px",
  } as CSSProperties;

  const floatingPanel =
    "absolute bottom-[128px] top-4 z-10 hidden animate-ds-pop-in flex-col overflow-hidden rounded-ds-panel border border-ds-outline-variant bg-ds-panel shadow-ds-2 backdrop-blur-ds-panel lg:flex";

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-ds-canvas">
      <Header
        onSearchChange={setSearchQuery}
        mapMode={mapMode}
        onMapModeChange={changeMapMode}
        basemap={basemap}
        onBasemapChange={setBasemap}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div
        style={stageStyle}
        className={cn(
          "ep-map-stage relative min-h-0 flex-1 overflow-hidden",
          "[--ep-inset-bottom:172px] [--ep-inset-left:12px] [--ep-inset-right:12px] [--ep-inset-top:12px]",
          "lg:[--ep-inset-bottom:16px] lg:[--ep-inset-left:16px] lg:[--ep-inset-right:var(--ep-inset-right-lg)] lg:[--ep-inset-top:var(--ep-inset-top-lg)]"
        )}
      >
        <div className="absolute inset-0">
          {mapMode === "2d" ? (
            <MapContainer {...mapProps} onViewChange={setMapView} basemap={basemap} selectedEarthquakeId={selectedQuakeId} />
          ) : (
            <GlobeContainer {...mapProps} selectedEarthquakeId={selectedQuakeId} theme={theme} />
          )}
        </div>

        {/* ---------- Escritorio: panel "Controles" (izquierda) ---------- */}
        {controlsOpen ? (
          <aside aria-label={tPanel("controls")} className={cn(floatingPanel, "left-4 w-[360px]")}>
            <PanelHeader
              title={tPanel("controls")}
              icon={SlidersHorizontal}
              onClose={() => setControlsOpen(false)}
              closeLabel={tPanel("close")}
            />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              <ControlsPanel visibility={visibility} onChange={setLayer} />
            </div>
          </aside>
        ) : (
          <Button
            variant="elevated"
            size="lg"
            onClick={() => setControlsOpen(true)}
            className="absolute left-4 top-4 z-10 hidden lg:inline-flex"
          >
            <MorphIcon icon={SlidersHorizontal} size={20} reducedMotion="user" />
            {tPanel("controls")}
          </Button>
        )}

        {/* ---------- Escritorio: panel "Eventos" (derecha) ---------- */}
        {eventsOpen ? (
          <aside aria-label={t("title")} className={cn(floatingPanel, "right-4 w-[340px]")}>
            <PanelHeader
              title={t("title")}
              icon={Inbox}
              meta={feedBadge}
              onClose={() => setEventsOpen(false)}
              closeLabel={tPanel("close")}
            />
            {/* En viewports bajos todo el cuerpo hace scroll; en altos la lista llena el espacio. */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
              {metrics}
              {eventList("-mx-1 flex-none [@media(min-height:760px)]:min-h-[220px] [@media(min-height:760px)]:flex-1")}
              <div className="shrink-0 border-t border-ds-outline-variant pt-3">{trend}</div>
            </div>
          </aside>
        ) : (
          <Button
            variant="elevated"
            size="lg"
            onClick={() => setEventsOpen(true)}
            className="absolute right-4 top-4 z-10 hidden lg:inline-flex"
          >
            <MorphIcon icon={Inbox} size={20} reducedMotion="user" />
            {t("title")}
            <span className="grid h-6 min-w-6 place-items-center rounded-ds-full bg-ds-primary px-1.5 text-xs font-medium text-ds-primary-on">
              {eventTotal > 999 ? "999+" : eventTotal}
            </span>
          </Button>
        )}

        {/* ---------- Fila inferior: accesos móviles + timeline + leyenda ---------- */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] lg:inset-x-4 lg:bottom-4 lg:grid lg:grid-cols-[1fr_minmax(0,640px)_1fr] lg:items-end lg:gap-4">
          <div className="pointer-events-auto flex gap-2 lg:hidden">
            <Button variant="elevated" onClick={() => setMobileSheet("layers")} className="flex-1 sm:flex-none">
              <MorphIcon icon={SlidersHorizontal} size={18} reducedMotion="user" />
              {tPanel("controls")}
            </Button>
            <Button variant="elevated" onClick={() => setMobileSheet("events")} className="flex-1 sm:flex-none">
              <MorphIcon icon={Inbox} size={18} reducedMotion="user" />
              {t("title")}
              <span className="grid h-5 min-w-5 place-items-center rounded-ds-full bg-ds-primary px-1 text-[11px] font-medium text-ds-primary-on">
                {eventTotal > 999 ? "999+" : eventTotal}
              </span>
            </Button>
          </div>

          <span className="hidden lg:block" aria-hidden="true" />

          <TimeControl
            window={timeWindow}
            onWindowChange={changeWindow}
            playing={playing}
            onTogglePlayback={() => setPlaying((p) => !p)}
            liveLabel={tTime("live")}
            playbackLabel={tTime("playback")}
            windowLabel={tTime("window")}
            locale={locale}
            playhead={playhead}
            playProgress={playProgress}
            note={timeWindow === "7d" ? tTime("weekNote") : undefined}
            className="pointer-events-auto w-full"
          />

          <div className="hidden justify-self-end xl:block">
            <Legend variant="floating" className="pointer-events-auto" />
          </div>
        </div>

        {/* ---------- Móvil/tablet: bottom sheet ---------- */}
        {mobileSheet && (
          <div className="absolute inset-0 z-40 flex items-end lg:hidden">
            <button
              type="button"
              aria-label={tPanel("close")}
              onClick={() => setMobileSheet(null)}
              className="absolute inset-0 animate-ds-fade-in bg-ds-scrim"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={mobileSheet === "layers" ? tPanel("controls") : t("title")}
              className="relative flex max-h-[85%] w-full animate-ds-sheet-in flex-col overflow-hidden rounded-t-ds-sheet bg-ds-surface-container shadow-ds-3 sm:mx-auto sm:max-w-xl"
            >
              <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-ds-outline" aria-hidden="true" />
              <PanelHeader
                title={mobileSheet === "layers" ? tPanel("controls") : t("title")}
                icon={mobileSheet === "layers" ? SlidersHorizontal : Inbox}
                meta={mobileSheet === "events" ? feedBadge : undefined}
                autoFocusClose
                onClose={() => setMobileSheet(null)}
                closeLabel={tPanel("close")}
              />
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                {mobileSheet === "layers" ? (
                  <div className="py-2">
                    <ControlsPanel visibility={visibility} onChange={setLayer} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-3">
                    {metrics}
                    {eventList("-mx-1 overflow-visible")}
                    <div className="border-t border-ds-outline-variant pt-3">{trend}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
