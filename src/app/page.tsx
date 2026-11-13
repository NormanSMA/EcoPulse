'use client';

import { useState, useEffect, useMemo, useCallback, useReducer, useRef, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChevronDown, Clock, Download, Inbox, SlidersHorizontal, X } from "lucide";
import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { I18nProvider, useLocale } from "@/design-system/i18n/I18nProvider";
import { useBasemap } from "@/design-system/hooks";
import type { LayerKey } from "@/design-system/tokens";
import { cn } from "@/design-system/utils/cn";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";
import { useLiveData, radarFrameAt } from "@/lib/useLiveData";
import { resolveSelection } from "@/lib/resolveSelection";
import { selectionFromEntityId, type Selection } from "@/lib/selection";
import type { OmniboxAction } from "@/components/ui/CommandOmnibox";
import { ZonePanel } from "@/components/ui/ZonePanel";
import { Section } from "@/components/ui/Section";
import { frameAt } from "@/lib/forecast/series";
import { useWeatherGrid } from "@/lib/forecast/useWeatherGrid";
import { OFFLINE_ASSET_URLS } from "@/lib/mapStyles";
import { registerSW } from "@/lib/offline/registerSW";
import { useOnline } from "@/lib/offline/useOnline";
import { pickZone } from "@/lib/zones/pickZone";
import type { ZonePack } from "@/lib/zones/types";
import type { MapData, LayerVisibility } from "@/components/map/types";
import Header, { type MapMode } from "@/components/ui/Header";
import ControlsPanel from "@/components/ui/ControlsPanel";
import EventsPanel, { type EventItem } from "@/components/ui/EventsPanel";
import { DetailPanel, preloadDetailCharts } from "@/components/ui/DetailPanel";
import { Button, IconButton } from "@/components/ui/Button";
import { TimeControl } from "@/components/ui/TimeControl";
import { explorerReducer, initialExplorerState, inSpatialFilter, mobileSheet, type Layout } from "@/lib/explorerState";
import { HOUR_MS, globalMode, playbackEnded, resolveTimeline, seekTime, type TimeWindow } from "@/lib/timeline";
import { Legend } from "@/components/ui/Legend";

const MAP_LOADING = (
  <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ds-canvas text-ds-text-secondary">
    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ds-surface-highest border-t-ds-primary" />
    <p className="text-sm">Inicializando motor de renderizado WebGL…</p>
  </div>
);

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), { ssr: false, loading: () => MAP_LOADING });

const PLAYBACK_DURATION_MS = 20_000;
const PLAYBACK_TICK_MS = 100;
const SPEEDS = [1, 2, 4];
const LG_QUERY = "(min-width: 1024px)";
// Bajo xl los dos paneles flotantes (360 + 376 px) casi cubren el mapa.
const XL_QUERY = "(min-width: 1280px)";

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
  wind: false,
  clouds: false,
  rain: false,
  airQuality: false,
  volcanoCatalog: false,
  tectonics: false,
};

/** Cabecera de panel flotante: título + cerrar (como "Controls ✕" de Weather Lab). */
function PanelHeader({ title, icon, meta, onClose, closeLabel, autoFocusClose }: { title: string; icon: IconNode; meta?: ReactNode; onClose: () => void; closeLabel: string; autoFocusClose?: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ds-divider pl-5 pr-2">
      <MorphIcon icon={icon} size={20} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
      <h2 className="ds-eyebrow min-w-0 flex-1 truncate !text-[12px] !text-ds-text-primary">{title}</h2>
      {meta}
      <IconButton aria-label={closeLabel} onClick={onClose} autoFocus={autoFocusClose}>
        <MorphIcon icon={X} size={20} reducedMotion="user" />
      </IconButton>
    </div>
  );
}

/** Tamaño de pantalla que decide el contenedor de los paneles. null hasta montar. */
function useLayout(): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    const lg = window.matchMedia(LG_QUERY);
    const xl = window.matchMedia(XL_QUERY);
    const update = () => setLayout(xl.matches ? "wide" : lg.matches ? "medium" : "mobile");
    update();
    lg.addEventListener("change", update);
    xl.addEventListener("change", update);
    return () => {
      lg.removeEventListener("change", update);
      xl.removeEventListener("change", update);
    };
  }, []);
  return layout;
}

function HomePageContent() {
  const t = useTranslations("events");
  const tPanel = useTranslations("panel");
  const tTime = useTranslations("timeControl");
  const tOmni = useTranslations("omnibox");
  const tZones = useTranslations("zones");
  const tOffline = useTranslations("offline");
  const tPlates = useTranslations("detail.tectonics.plateNames");
  const { locale } = useLocale();

  const [visibility, setVisibility] = useState<LayerVisibility>(INITIAL_VISIBILITY);
  const [minMag, setMinMag] = useState(0);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("live");
  const [playing, setPlaying] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [mapView, setMapView] = useState<MapView>(DEFAULT_MAP_VIEW);
  const { basemap, setBasemap } = useBasemap();
  const [timeOpen, setTimeOpen] = useState(true);

  // ---------- Conexión y arranque sin red ----------
  const online = useOnline();
  useEffect(() => {
    // Registra el service worker y le pasa el cascarón del build actual.
    // Después se piden los chunks diferidos que hacen falta sin red (gráficos
    // del detalle): con el worker ya activo, quedan guardados.
    registerSW(OFFLINE_ASSET_URLS).then(() => preloadDetailCharts());
  }, []);
  // Zona guardada que se muestra en el mapa (sus puntos alimentan las capas de clima).
  const [activePack, setActivePack] = useState<ZonePack | null>(null);

  // ---------- Selección, cámara y paneles: un solo estado ----------
  // Escritorio y móvil leen lo mismo; solo cambia el contenedor (panel u hoja).
  const layout = useLayout();
  const layoutRef = useRef<Layout>("wide");
  const [explorer, dispatch] = useReducer(explorerReducer, "wide", initialExplorerState);
  useEffect(() => {
    if (!layout) return;
    const previous = layoutRef.current;
    layoutRef.current = layout;
    dispatch({ type: "layout", layout, previous });
  }, [layout]);
  const { selection, focus, spatialFilter } = explorer;
  const isDesktop = layout === "medium" || layout === "wide";
  const sheet = layout === "mobile" ? mobileSheet(explorer) : null;
  const controlsOpen = explorer.left;
  const eventsOpen = explorer.right !== null;

  const setLayer = useCallback((key: LayerKey, value: boolean) => {
    setVisibility((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  // Cerrar la hoja de detalle también quita la selección (y su anillo en el mapa).
  const closeSheet = useCallback(() => {
    if (sheet === "detail") dispatch({ type: "clearSelection", layout: "mobile" });
    else if (sheet === "layers") dispatch({ type: "closeLeft" });
    else dispatch({ type: "closeRight", layout: "mobile" });
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  // ---------- Ventana temporal y reproducción (lógica en lib/timeline) ----------
  // live = todo lo disponible; 1h/6h/24h/7d filtran sismos, incendios y
  // desastres (7d usa el feed semanal). +24h/+48h/+72h recorren el pronóstico
  // sin ocultar los eventos actuales. La reproducción recorre la ventana en
  // ~20 s; mapa, globo, radar, día/noche y gráficos siguen el cursor.
  const [customStart, setCustomStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [playhead, setPlayhead] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const timeline = useMemo(() => resolveTimeline({ window: timeWindow, customStart, playhead, now }), [timeWindow, customStart, playhead, now]);
  const { refTime, rangeStart, rangeEnd, playProgress, usesWeek, windowMs, span } = timeline;
  const forecastMode = timeline.mode === "forecast";

  const live = useLiveData({
    needWeek: timeline.needWeek,
    needAir: visibility.airQuality,
    needCatalog: visibility.volcanoCatalog,
    needRadar: visibility.radar,
    needTectonics: visibility.tectonics,
  });

  useEffect(() => {
    if (!playing) return;
    const step = (span * PLAYBACK_TICK_MS * speed) / PLAYBACK_DURATION_MS;
    const start = () => (forecastMode ? Date.now() : Date.now() - span);
    setPlayhead((p) => p ?? start());
    const id = setInterval(() => setPlayhead((p) => (p ?? start()) + step), PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [playing, span, speed, forecastMode]);

  useEffect(() => {
    if (playbackEnded(playhead, timeline, Date.now())) {
      setPlaying(false);
      setPlayhead(null);
    }
  }, [playhead, timeline]);

  const changeWindow = useCallback((w: TimeWindow) => {
    setTimeWindow(w);
    setPlaying(false);
    setPlayhead(null);
  }, []);

  const pickDay = useCallback((startMs: number) => {
    setNow(Date.now());
    setCustomStart(startMs);
    setTimeWindow("custom");
    setPlaying(false);
    setPlayhead(null);
  }, []);

  // Arrastre de la barra: mueve el cursor aunque esté en pausa.
  const seek = useCallback((fraction: number) => setPlayhead(seekTime(fraction, timeline, Date.now())), [timeline]);
  const cycleSpeed = useCallback(() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]), []);

  // ---------- Datos filtrados por tiempo y radio (idénticos para 2D y 3D) ----------
  const data: MapData = useMemo(() => {
    const inRange = (ts: number) => ts >= rangeStart && ts <= rangeEnd;
    const near = (coords: readonly number[]) => inSpatialFilter(spatialFilter, coords[0], coords[1]);
    const quakes = usesWeek && live.weekQuakes ? live.weekQuakes : live.earthquakes;
    // Un ciclón con trayectoria visible no se repite como icono de desastre.
    const tracked = new Set(visibility.cyclones ? live.cyclones.features.map((f) => f.properties.eventId) : []);
    return {
      earthquakes: {
        ...quakes,
        features: quakes.features.filter(
          (f) => inRange(f.properties.time) && (minMag === 0 || (f.properties.mag ?? -1) >= minMag) && near(f.geometry.coordinates)
        ),
      },
      fires: {
        ...live.fires,
        features: live.fires.features.filter((f) => inRange(Date.parse(f.properties.acquiredAt)) && near(f.geometry.coordinates)),
      },
      disasters: {
        ...live.disasters,
        features: live.disasters.features.filter(
          (f) =>
            !tracked.has(f.properties.eventId) &&
            (f.properties.fromDate ? inRange(Date.parse(f.properties.fromDate)) : rangeStart === -Infinity) &&
            near(f.geometry.coordinates)
        ),
      },
      cyclones: live.cyclones,
      volcanoes: spatialFilter ? { ...live.volcanoes, features: live.volcanoes.features.filter((f) => near(f.geometry.coordinates)) } : live.volcanoes,
      volcanoCatalog: live.volcanoCatalog,
      airQuality: live.airQuality,
      iss: live.iss,
      // Nombres de placa en el idioma de la interfaz (PB2002 los trae en inglés).
      tectonics: live.tectonics && {
        ...live.tectonics,
        plates: {
          ...live.tectonics.plates,
          features: live.tectonics.plates.features.map((f) =>
            tPlates.has(f.properties.code) ? { ...f, properties: { ...f.properties, name: tPlates(f.properties.code) } } : f
          ),
        },
      },
    };
  }, [live, usesWeek, rangeStart, rangeEnd, visibility.cyclones, tPlates, minMag, spatialFilter]);

  // Resumen del periodo con los sismos ya filtrados (hasta el playhead).
  const summary = useMemo(() => {
    if (forecastMode) return `${tTime("nextHours", { n: timeline.horizonHours })} · ${tTime("forecastNote")}`;
    const label = timeWindow === "custom" && customStart != null
      ? tTime("since", { day: new Date(customStart).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) })
      : windowMs == null || timeWindow === "24h" ? tTime("lastHours", { n: 24 }) : timeWindow === "7d" ? tTime("lastDays", { n: 7 }) : tTime("lastHours", { n: parseInt(timeWindow, 10) });
    if (timeWindow === "live" && playhead == null) return label;
    // La semana de sismos aún se descarga: no mostrar "0 sismos".
    if (usesWeek && !live.weekQuakes) return `${label} · ${tTime("loading")}`;
    const mags = data.earthquakes.features.map((f) => f.properties.mag).filter((m): m is number => typeof m === "number");
    if (mags.length === 0) return tTime("summary", { label, count: 0, max: "-" });
    const max = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.max(...mags));
    return tTime("summary", { label, count: mags.length, max });
  }, [data.earthquakes, timeWindow, customStart, windowMs, playhead, tTime, locale, usesWeek, live.weekQuakes, forecastMode, timeline.horizonHours]);

  // ---------- Pronóstico sobre la malla (viento, nubes, lluvia) ----------
  // Con una zona guardada en pantalla se usa su paquete; si no, la malla que
  // corresponde a lo que se ve (país, metropolitana o táctica según el zoom).
  const weatherOn = visibility.wind || visibility.clouds || visibility.rain;
  const autoZone = useMemo(
    () => (weatherOn && online && !activePack ? pickZone(mapView.lng, mapView.lat, mapView.zoom) : null),
    [weatherOn, online, activePack, mapView]
  );
  const liveGrid = useWeatherGrid(autoZone);
  const grid = activePack?.forecast ?? liveGrid.grid;
  const frameHour = Math.floor(refTime / HOUR_MS);
  const weatherFrame = useMemo(() => {
    if (!grid || grid.time.length === 0) return null;
    // Fuera del rango del pronóstico (pasado o más allá de 72 h) se usa el extremo más cercano.
    const at = Math.min(Math.max(frameHour * HOUR_MS, grid.time[0]), grid.time[grid.time.length - 1]);
    return frameAt(grid, at);
  }, [grid, frameHour]);

  // El radar solo tiene pasado y unos minutos de pronóstico inmediato.
  const radarTiles = visibility.radar ? radarFrameAt(live.radar, Math.min(refTime, now))?.tiles ?? null : null;
  // Capas cuya fuente falló o agotó el tiempo en el último ciclo.
  const layersDown = useMemo(
    () => Object.fromEntries(Object.entries(live.sourceStatus).map(([key, s]) => [key, s.status === "error" || s.status === "timeout"])),
    [live.sourceStatus]
  );

  // ---------- Selección (misma para 2D y 3D) ----------
  const resolved = useMemo(() => resolveSelection(selection, data, live.weekQuakes?.features), [selection, data, live.weekQuakes]);
  const selectedPoint = resolved?.coords ?? null;

  const select = useCallback((s: Selection, fly?: [number, number]) => {
    dispatch({ type: "select", selection: s, fly, layout: layoutRef.current, now: Date.now() });
  }, []);
  const selectOnMap = useCallback((s: Selection) => select(s), [select]);
  const openControls = useCallback(() => dispatch({ type: "openLeft", layout: layoutRef.current }), []);
  const openEvents = useCallback(() => dispatch({ type: "openRight", layout: layoutRef.current }), []);
  const closeControls = useCallback(() => dispatch({ type: "closeLeft" }), []);
  const closeEvents = useCallback(() => dispatch({ type: "closeRight", layout: layoutRef.current }), []);
  const closeDetail = useCallback(() => dispatch({ type: "clearSelection", layout: layoutRef.current }), []);

  const pickEvent = useCallback((item: EventItem) => select(item.selection, [item.coords[0], item.coords[1]]), [select]);

  // Buscador único: lugar, coordenadas o "@km" (radio alrededor del lugar o de mi ubicación).
  const onSearch = useCallback(
    (action: OmniboxAction) => {
      if (action.type === "here") {
        dispatch({ type: "located", at: action.at });
        dispatch({ type: "setFilter", filter: { center: action.at, radiusKm: action.radiusKm, label: tOmni("myLocation") } });
        select({ kind: "point", lon: action.at[0], lat: action.at[1], name: tOmni("myLocation") }, action.at);
        return;
      }
      const { place, radiusKm } = action;
      const center: [number, number] = [place.lon, place.lat];
      if (radiusKm) dispatch({ type: "setFilter", filter: { center, radiusKm, label: place.name } });
      select({ kind: "point", lon: place.lon, lat: place.lat, name: place.name, detail: place.detail || undefined }, center);
    },
    [select, tOmni]
  );
  const clearFilter = useCallback(() => dispatch({ type: "setFilter", filter: null }), []);
  const filterLabel = spatialFilter ? tOmni("filterActive", { km: spatialFilter.radiusKm, place: spatialFilter.label ?? "" }) : null;

  // Deep link ?sel=<entityId>: selecciona y centra cuando el evento resuelve.
  const [pendingSel, setPendingSel] = useState<Selection | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("sel");
    if (id) setPendingSel(selectionFromEntityId(id));
  }, []);
  const pendingResolved = useMemo(
    () => resolveSelection(pendingSel, data, live.weekQuakes?.features),
    [pendingSel, data, live.weekQuakes]
  );
  useEffect(() => {
    if (!pendingSel || !pendingResolved) return;
    select(pendingSel, pendingResolved.coords);
    setPendingSel(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("sel");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [pendingSel, pendingResolved, select]);

  const changeMapMode = useCallback((mode: MapMode) => {
    dispatch({ type: "clearFocus" });
    setMapMode(mode);
  }, []);

  const viewProps = {
    data,
    visibility,
    refTime,
    radarTiles,
    selectedPoint,
    onSelect: selectOnMap,
    focus,
    spatialFilter,
    weatherFrame,
    showGridPoints: activePack !== null,
    initialView: mapView,
  };

  const events = (className?: string) => (
    <EventsPanel data={data} visibility={visibility} locale={locale} selected={selection} onPick={pickEvent} loading={live.quakesStatus === "loading"} error={live.quakesStatus === "error"} className={className} />
  );

  // ---------- Zonas sin conexión ----------
  const showPack = useCallback((pack: ZonePack | null) => {
    setActivePack(pack);
    if (pack) dispatch({ type: "focus", at: pack.meta.zone.center, now: Date.now() });
  }, []);
  const liveEvents = useMemo(
    () => ({
      earthquakes: live.earthquakes.features,
      fires: live.fires.features,
      disasters: live.disasters.features,
      cyclones: live.cyclones.features,
      volcanoes: live.volcanoes.features,
    }),
    [live.earthquakes, live.fires, live.disasters, live.cyclones, live.volcanoes]
  );
  const zoneCenter = selectedPoint
    ? { lon: selectedPoint[0], lat: selectedPoint[1], name: resolved?.item.kind === "point" ? resolved.item.name ?? null : null }
    : { lon: mapView.lng, lat: mapView.lat, name: null };
  const zonesSection = (
    <Section title={tZones("title")} icon={Download} defaultOpen={!online}>
      <ZonePanel locale={locale === "en" ? "en" : "es"} online={online} center={zoneCenter} events={liveEvents} activeZoneId={activePack?.meta.id ?? null} onShow={showPack} />
    </Section>
  );
  // Sin red: mapa base mínimo y solo 2D (el globo depende de teselas remotas).
  const shownBasemap = online ? basemap : "offline";
  const shownMode: MapMode = online ? mapMode : "2d";

  // Texto del indicador sin conexión (antes era un banner bajo el header).
  const offlineNote = [
    tOffline("banner"),
    live.snapshotAt != null
      ? tOffline("snapshot", { date: new Date(live.snapshotAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })
      : "",
    mapMode === "3d" ? `${tOffline("globeDisabled")}.` : "",
  ].filter(Boolean).join(" ");

  // Desplazamientos de los controles nativos del mapa para no quedar bajo los paneles.
  const stageStyle = {
    "--ep-inset-right-lg": eventsOpen ? "392px" : "16px",
    // Con el panel derecho cerrado, el botón "Eventos" (48 px) ocupa la esquina:
    // el zoom baja debajo de él para no taparse.
    "--ep-inset-top-lg": eventsOpen ? "88px" : "148px",
  } as CSSProperties;

  // Los paneles de escritorio solo se montan en escritorio: ocultos por CSS
  // seguirían pidiendo datos del detalle y recalculando la lista de eventos.
  const floatingPanel =
    `ds-glass absolute ${timeOpen ? "bottom-[128px]" : "bottom-[80px]"} top-[88px] z-10 hidden animate-ds-pop-in flex-col overflow-hidden rounded-ds-panel lg:flex`;

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-ds-canvas">
      <Header
        onSearch={onSearch}
        filterLabel={filterLabel}
        onClearFilter={clearFilter}
        mapMode={mapMode}
        onMapModeChange={changeMapMode}
        basemap={basemap}
        onBasemapChange={setBasemap}
        mode={globalMode({ online, window: timeWindow, playing })}
        offlineNote={online ? undefined : offlineNote}
      />


      <div
        style={stageStyle}
        className={cn(
          "ep-map-stage relative min-h-0 flex-1 overflow-hidden",
          timeOpen ? "[--ep-inset-bottom:172px]" : "[--ep-inset-bottom:72px]",
          "[--ep-inset-left:12px] [--ep-inset-right:12px] [--ep-inset-top:84px]",
          "lg:[--ep-inset-bottom:16px] lg:[--ep-inset-left:16px] lg:[--ep-inset-right:var(--ep-inset-right-lg)] lg:[--ep-inset-top:var(--ep-inset-top-lg)]"
        )}
      >
        <div className="absolute inset-0">
          <MapContainer
            {...viewProps}
            onViewChange={setMapView}
            basemap={shownBasemap}
            projection={shownMode === "3d" ? "globe" : "mercator"}
          />
        </div>

        {/* ---------- Escritorio: panel "Controles" (izquierda) ---------- */}
        {controlsOpen && isDesktop ? (
          <aside aria-label={tPanel("controls")} className={cn(floatingPanel, "left-4 w-72")}>
            <PanelHeader title={tPanel("controls")} icon={SlidersHorizontal} onClose={closeControls} closeLabel={tPanel("close")} />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              <ControlsPanel visibility={visibility} onChange={setLayer} minMag={minMag} onMinMagChange={setMinMag} down={layersDown} extra={zonesSection} />
            </div>
          </aside>
        ) : (
          <Button variant="elevated" size="lg" onClick={openControls} className="absolute left-4 top-[88px] z-10 hidden lg:inline-flex">
            <MorphIcon icon={SlidersHorizontal} size={20} reducedMotion="user" />
            {tPanel("controls")}
          </Button>
        )}

        {/* ---------- Escritorio: eventos o detalle (derecha) ---------- */}
        {eventsOpen && isDesktop ? (
          <aside aria-label={selection ? tPanel("detail") : t("title")} className={cn(floatingPanel, "right-4 w-[360px]")}>
            {selection ? (
              <DetailPanel kind={selection.kind} resolved={resolved} tectonics={data.tectonics} locale={locale} onClose={closeDetail} cursorTime={forecastMode ? refTime : null} backToEvents className="h-full" />
            ) : (
              <>
                <PanelHeader title={t("title")} icon={Inbox} onClose={closeEvents} closeLabel={tPanel("close")} />
                {events("min-h-0 flex-1 p-3")}
              </>
            )}
          </aside>
        ) : (
          <Button variant="elevated" size="lg" onClick={openEvents} className="absolute right-4 top-[88px] z-10 hidden lg:inline-flex">
            <MorphIcon icon={Inbox} size={20} reducedMotion="user" />
            {t("title")}
          </Button>
        )}

        {/* ---------- Fila inferior: accesos móviles + timeline + leyenda ---------- */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2 pb-[env(safe-area-inset-bottom)] lg:inset-x-4 lg:bottom-4 lg:grid lg:grid-cols-[1fr_minmax(0,640px)_1fr] lg:items-end lg:gap-4">
          <div className="pointer-events-auto flex gap-2 lg:hidden">
            <Button variant="elevated" onClick={openControls} className="min-w-0 flex-1 px-3 sm:flex-none">
              <MorphIcon icon={SlidersHorizontal} size={18} reducedMotion="user" />
              {tPanel("controls")}
            </Button>
            <Button variant="elevated" onClick={openEvents} className="min-w-0 flex-1 px-3 sm:flex-none">
              <MorphIcon icon={Inbox} size={18} reducedMotion="user" />
              {selection ? tPanel("detail") : t("title")}
            </Button>
            {!timeOpen && (
              <Button variant="elevated" onClick={() => setTimeOpen(true)} aria-label={tTime("show")} className="shrink-0">
                <MorphIcon icon={Clock} size={18} reducedMotion="user" />
              </Button>
            )}
          </div>

          <span className="hidden lg:block" aria-hidden="true" />

          {!timeOpen && (
            <div className="pointer-events-auto hidden justify-self-center lg:block">
              <Button variant="elevated" size="lg" onClick={() => setTimeOpen(true)}>
                <MorphIcon icon={Clock} size={20} reducedMotion="user" />
                {tTime("show")}
              </Button>
            </div>
          )}

          <div className={cn("pointer-events-auto relative w-full", !timeOpen && "hidden")}>
          <button
            type="button"
            onClick={() => setTimeOpen(false)}
            aria-label={tTime("hide")}
            title={tTime("hide")}
            className="ds-glass absolute -top-3 left-1/2 z-10 grid h-7 w-12 -translate-x-1/2 place-items-center rounded-ds-full text-ds-text-secondary hover:text-ds-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary"
          >
            <MorphIcon icon={ChevronDown} size={18} reducedMotion="user" />
          </button>
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
            summary={summary}
            onSeek={seek}
            speed={speed}
            onCycleSpeed={cycleSpeed}
            speedLabel={tTime("speed")}
            seekLabel={tTime("seek")}
            customStart={customStart}
            onCustomStart={pickDay}
            fromLabel={tTime("from")}
            todayLabel={tTime("today")}
            yesterdayLabel={tTime("yesterday")}
            note={timeWindow === "7d" ? tTime("weekNote") : undefined}
            className="w-full pt-4 sm:pt-3"
          />
          </div>

          {/* Con el panel derecho abierto la leyenda flotante lo taparía: sigue
              disponible dentro de Controles. */}
          <div className={cn("hidden justify-self-end", !eventsOpen && "xl:block")}>
            <Legend variant="floating" visibility={visibility} className="pointer-events-auto" />
          </div>
        </div>

        {/* ---------- Móvil/tablet: bottom sheet ---------- */}
        {sheet && (
          <div className="absolute inset-0 z-40 flex items-end lg:hidden">
            <button
              type="button"
              aria-label={tPanel("close")}
              onClick={closeSheet}
              className="absolute inset-0 animate-ds-fade-in bg-ds-scrim"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={sheet === "layers" ? tPanel("controls") : sheet === "detail" ? tPanel("detail") : t("title")}
              className="ds-glass relative flex max-h-[85%] w-full animate-ds-sheet-in flex-col overflow-hidden rounded-t-ds-sheet !border-b-0 sm:mx-auto sm:max-w-xl"
            >
              <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/25" aria-hidden="true" />
              {sheet === "detail" && selection ? (
                <DetailPanel kind={selection.kind} resolved={resolved} tectonics={data.tectonics} locale={locale} onClose={closeDetail} cursorTime={forecastMode ? refTime : null} className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]" />
              ) : (
                <>
                  <PanelHeader
                    title={sheet === "layers" ? tPanel("controls") : t("title")}
                    icon={sheet === "layers" ? SlidersHorizontal : Inbox}
                    autoFocusClose
                    onClose={closeSheet}
                    closeLabel={tPanel("close")}
                  />
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {sheet === "layers" ? (
                      <div className="py-2">
                        <ControlsPanel visibility={visibility} onChange={setLayer} minMag={minMag} onMinMagChange={setMinMag} down={layersDown} extra={zonesSection} />
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
