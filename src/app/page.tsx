'use client';

import { useState, useEffect, useMemo, useCallback, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Inbox, SlidersHorizontal, X } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { I18nProvider, useLocale } from "@/design-system/i18n/I18nProvider";
import { useFreshness, useTheme, useBasemap, useMediaQuery } from "@/design-system/hooks";
import type { LayerKey } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { useLiveData, radarFrameAt } from "@/lib/useLiveData";
import { resolveSelection } from "@/lib/resolveSelection";
import type { Selection } from "@/lib/selection";
import type { GeocodeResult } from "@/lib/pointInfo";
import type { MapData, LayerVisibility } from "@/components/map/types";
import Header, { type MapMode } from "@/components/ui/Header";
import ControlsPanel from "@/components/ui/ControlsPanel";
import EventsPanel, { type EventItem } from "@/components/ui/EventsPanel";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { Button, IconButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TimeControl, type TimeWindow } from "@/components/ui/TimeControl";
import { Legend } from "@/components/ui/Legend";

const MAP_LOADING = (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ds-canvas text-ds-text-secondary">
    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ds-surface-highest border-t-ds-primary" />
    <p className="text-sm">Inicializando motor de renderizado WebGL…</p>
  </div>
);

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), { ssr: false, loading: () => MAP_LOADING });
const GlobeContainer = dynamic(() => import("@/components/map/GlobeContainer"), { ssr: false, loading: () => MAP_LOADING });

const HOUR_MS = 3_600_000;
const WINDOW_MS: Record<TimeWindow, number | null> = { live: null, "1h": HOUR_MS, "6h": 6 * HOUR_MS, "24h": 24 * HOUR_MS, "7d": 7 * 24 * HOUR_MS };
const PLAYBACK_DURATION_MS = 20_000;
const PLAYBACK_TICK_MS = 100;
const LG_QUERY = "(min-width: 1024px)";

// Por defecto solo lo más relevante (sin sobrecargar el mapa).
const INITIAL_VISIBILITY: LayerVisibility = {
  earthquakes: true,
  fires: true,
  disasters: true,
  cyclones: true,
  volcanoes: true,
  iss: true,
  dayNight: true,
  radar: false,
  airQuality: false,
  volcanoCatalog: false,
};

/** Cabecera de panel flotante: título + cerrar (como "Controls ✕" de Weather Lab). */
function PanelHeader({ title, icon, meta, onClose, closeLabel, autoFocusClose }: { title: string; icon: IconNode; meta?: ReactNode; onClose: () => void; closeLabel: string; autoFocusClose?: boolean }) {
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
  const tPanel = useTranslations("panel");
  const tTime = useTranslations("timeControl");
  const { locale } = useLocale();

  const [visibility, setVisibility] = useState<LayerVisibility>(INITIAL_VISIBILITY);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("live");
  const [playing, setPlaying] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [mapView, setMapView] = useState<MapView>(DEFAULT_MAP_VIEW);
  const { theme, toggleTheme } = useTheme();
  const { basemap, setBasemap } = useBasemap(theme);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState<"layers" | "events" | "detail" | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; key: number } | null>(null);

  const live = useLiveData({
    needWeek: timeWindow === "7d",
    needAir: visibility.airQuality,
    needCatalog: visibility.volcanoCatalog,
    needRadar: visibility.radar,
  });

  const setLayer = useCallback((key: LayerKey, value: boolean) => {
    setVisibility((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!mobileSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Cerrar el detalle también quita la selección (y su anillo en el mapa).
      if (mobileSheet === "detail") setSelection(null);
      setMobileSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSheet]);

  // ---------- Ventana temporal y reproducción ----------
  // live = todo lo disponible; 1h/6h/24h/7d filtran sismos, incendios y
  // desastres (7d usa el feed semanal). La reproducción recorre la ventana
  // (24 h si es "live") en ~20 s; mapa, globo, radar y día/noche la siguen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const refTime = playhead ?? now;
  const rangeStart = windowMs != null || playhead != null ? now - span : -Infinity;
  const rangeEnd = playhead ?? Infinity;
  const playProgress = playhead != null ? (playhead - (now - span)) / span : null;

  // ---------- Datos filtrados por tiempo (idénticos para 2D y 3D) ----------
  const data: MapData = useMemo(() => {
    const inRange = (ts: number) => ts >= rangeStart && ts <= rangeEnd;
    const quakes = timeWindow === "7d" && live.weekQuakes ? live.weekQuakes : live.earthquakes;
    // Un ciclón con trayectoria visible no se repite como icono de desastre.
    const tracked = new Set(visibility.cyclones ? live.cyclones.features.map((f) => f.properties.eventId) : []);
    return {
      earthquakes: { ...quakes, features: quakes.features.filter((f) => inRange(f.properties.time)) },
      fires: { ...live.fires, features: live.fires.features.filter((f) => inRange(Date.parse(f.properties.acquiredAt))) },
      disasters: {
        ...live.disasters,
        features: live.disasters.features.filter(
          (f) => !tracked.has(f.properties.eventId) && (f.properties.fromDate ? inRange(Date.parse(f.properties.fromDate)) : rangeStart === -Infinity)
        ),
      },
      cyclones: live.cyclones,
      volcanoes: live.volcanoes,
      volcanoCatalog: live.volcanoCatalog,
      airQuality: live.airQuality,
      iss: live.iss,
    };
  }, [live, timeWindow, rangeStart, rangeEnd, visibility.cyclones]);

  const radarTiles = visibility.radar ? radarFrameAt(live.radar, refTime)?.tiles ?? null : null;
  const feedStatus = useFreshness(live.earthquakes.metadata.generated || null);
  const feedBadge = live.earthquakes.metadata.generated ? <StatusBadge status={feedStatus} size="sm" /> : null;

  // ---------- Selección (misma para 2D y 3D) ----------
  const resolved = useMemo(() => resolveSelection(selection, data, live.weekQuakes?.features), [selection, data, live.weekQuakes]);
  const selectedPoint = resolved?.coords ?? null;
  const isDesktop = useMediaQuery(LG_QUERY);

  const select = useCallback((s: Selection) => {
    setSelection(s);
    if (window.matchMedia(LG_QUERY).matches) setEventsOpen(true);
    else setMobileSheet("detail");
  }, []);

  const closeDetail = useCallback(() => {
    setSelection(null);
    setMobileSheet((m) => (m === "detail" ? null : m));
  }, []);

  const pickEvent = useCallback(
    (item: EventItem) => {
      setFocus({ lng: item.coords[0], lat: item.coords[1], key: Date.now() });
      select(item.selection);
    },
    [select]
  );

  const pickPlace = useCallback(
    (place: GeocodeResult) => {
      setFocus({ lng: place.lon, lat: place.lat, key: Date.now() });
      select({ kind: "point", lon: place.lon, lat: place.lat, name: place.name, detail: place.detail || undefined });
    },
    [select]
  );

  const changeMapMode = useCallback((mode: MapMode) => {
    setFocus(null);
    setMapMode(mode);
  }, []);

  const viewProps = {
    data,
    visibility,
    refTime,
    radarTiles,
    selectedPoint,
    onSelect: select,
    focus,
    initialView: mapView,
  };

  const events = (className?: string) => (
    <EventsPanel data={data} visibility={visibility} locale={locale} selected={selection} onPick={pickEvent} className={className} />
  );

  // Desplazamientos de los controles nativos del mapa para no quedar bajo los paneles.
  const stageStyle = {
    "--ep-inset-right-lg": eventsOpen ? "408px" : "16px",
    "--ep-inset-top-lg": eventsOpen ? "16px" : "80px",
  } as CSSProperties;

  // Los paneles de escritorio solo se montan en escritorio: ocultos por CSS
  // seguirían pidiendo datos del detalle y recalculando la lista de eventos.
  const floatingPanel =
    "absolute bottom-[128px] top-4 z-10 hidden animate-ds-pop-in flex-col overflow-hidden rounded-ds-panel border border-ds-outline-variant bg-ds-panel shadow-ds-2 backdrop-blur-ds-panel lg:flex";

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-ds-canvas">
      <Header
        onPlace={pickPlace}
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
            <MapContainer {...viewProps} onViewChange={setMapView} basemap={basemap} />
          ) : (
            <GlobeContainer {...viewProps} onViewChange={setMapView} theme={theme} />
          )}
        </div>

        {/* ---------- Escritorio: panel "Controles" (izquierda) ---------- */}
        {controlsOpen && isDesktop ? (
          <aside aria-label={tPanel("controls")} className={cn(floatingPanel, "left-4 w-[360px]")}>
            <PanelHeader title={tPanel("controls")} icon={SlidersHorizontal} onClose={() => setControlsOpen(false)} closeLabel={tPanel("close")} />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              <ControlsPanel visibility={visibility} onChange={setLayer} />
            </div>
          </aside>
        ) : (
          <Button variant="elevated" size="lg" onClick={() => setControlsOpen(true)} className="absolute left-4 top-4 z-10 hidden lg:inline-flex">
            <MorphIcon icon={SlidersHorizontal} size={20} reducedMotion="user" />
            {tPanel("controls")}
          </Button>
        )}

        {/* ---------- Escritorio: eventos o detalle (derecha) ---------- */}
        {eventsOpen && isDesktop ? (
          <aside aria-label={selection ? tPanel("detail") : t("title")} className={cn(floatingPanel, "right-4 w-[376px]")}>
            {selection ? (
              <DetailPanel kind={selection.kind} resolved={resolved} locale={locale} onClose={closeDetail} backToEvents className="h-full" />
            ) : (
              <>
                <PanelHeader title={t("title")} icon={Inbox} meta={feedBadge} onClose={() => setEventsOpen(false)} closeLabel={tPanel("close")} />
                {events("min-h-0 flex-1 p-3")}
              </>
            )}
          </aside>
        ) : (
          <Button variant="elevated" size="lg" onClick={() => setEventsOpen(true)} className="absolute right-4 top-4 z-10 hidden lg:inline-flex">
            <MorphIcon icon={Inbox} size={20} reducedMotion="user" />
            {t("title")}
          </Button>
        )}

        {/* ---------- Fila inferior: accesos móviles + timeline + leyenda ---------- */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] lg:inset-x-4 lg:bottom-4 lg:grid lg:grid-cols-[1fr_minmax(0,640px)_1fr] lg:items-end lg:gap-4">
          <div className="pointer-events-auto flex gap-2 lg:hidden">
            <Button variant="elevated" onClick={() => setMobileSheet("layers")} className="flex-1 sm:flex-none">
              <MorphIcon icon={SlidersHorizontal} size={18} reducedMotion="user" />
              {tPanel("controls")}
            </Button>
            <Button variant="elevated" onClick={() => setMobileSheet(selection ? "detail" : "events")} className="flex-1 sm:flex-none">
              <MorphIcon icon={Inbox} size={18} reducedMotion="user" />
              {selection ? tPanel("detail") : t("title")}
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

          {/* Con el panel derecho abierto la leyenda flotante lo taparía: sigue
              disponible dentro de Controles. */}
          <div className={cn("hidden justify-self-end", !eventsOpen && "xl:block")}>
            <Legend variant="floating" visibility={visibility} className="pointer-events-auto" />
          </div>
        </div>

        {/* ---------- Móvil/tablet: bottom sheet ---------- */}
        {mobileSheet && (
          <div className="absolute inset-0 z-40 flex items-end lg:hidden">
            <button
              type="button"
              aria-label={tPanel("close")}
              onClick={() => (mobileSheet === "detail" ? closeDetail() : setMobileSheet(null))}
              className="absolute inset-0 animate-ds-fade-in bg-ds-scrim"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={mobileSheet === "layers" ? tPanel("controls") : mobileSheet === "detail" ? tPanel("detail") : t("title")}
              className="relative flex max-h-[85%] w-full animate-ds-sheet-in flex-col overflow-hidden rounded-t-ds-sheet bg-ds-surface-container shadow-ds-3 sm:mx-auto sm:max-w-xl"
            >
              <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-ds-outline" aria-hidden="true" />
              {mobileSheet === "detail" && selection ? (
                <DetailPanel kind={selection.kind} resolved={resolved} locale={locale} onClose={closeDetail} className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]" />
              ) : (
                <>
                  <PanelHeader
                    title={mobileSheet === "layers" ? tPanel("controls") : t("title")}
                    icon={mobileSheet === "layers" ? SlidersHorizontal : Inbox}
                    meta={mobileSheet === "events" ? feedBadge : undefined}
                    autoFocusClose
                    onClose={() => setMobileSheet(null)}
                    closeLabel={tPanel("close")}
                  />
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {mobileSheet === "layers" ? (
                      <div className="py-2">
                        <ControlsPanel visibility={visibility} onChange={setLayer} />
                      </div>
                    ) : (
                      events("min-h-[60vh] p-3")
                    )}
                  </div>
                </>
              )}
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
