'use client';

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  EarthquakeGeoJSON,
  AirQualityGeoJSON,
  FireGeoJSON,
  WeatherGeoJSON,
  DisasterGeoJSON,
  IssGeoJSON,
  VolcanoGeoJSON,
  AirQualityModelGeoJSON,
} from "@/lib/types";
import { getAQICategory } from "@/lib/openaq";
import { dedupeByKey } from "@/lib/ingest";
import { DEFAULT_MAP_VIEW, type MapView } from "@/lib/mapView";

interface GlobeContainerProps {
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
  selectedEarthquakeId?: string | null;
  onViewChange?: (view: MapView) => void;
  initialView?: MapView;
  theme: "light" | "dark";
}

const EARTH_RADIUS_M = 6371000;
// Formula de conversión zoom (estilo slippy-map) -> altitud de cámara,
// aproximación estándar usada en demos de sincronización MapLibre/Mapbox <->
// Cesium (no es exacta porque depende del FOV/tamaño de pantalla, pero es
// suficiente para preservar una vista "parecida" al cambiar de 2D a 3D).
function zoomToAltitude(lat: number, zoom: number): number {
  return (591657527.591555 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

// Inclinación orbital real de la ISS (grados) — constante pública conocida.
const ISS_INCLINATION_DEG = 51.6431;

// Dibuja un círculo máximo que pasa por la posición actual de la ISS con la
// inclinación orbital real. Es una aproximación GEOMÉTRICA de la órbita, no
// una propagación física: /api/iss solo expone la posición actual (lat/lon/
// altitud), no un vector de velocidad direccional, así que no hay forma de
// saber en qué sentido avanza la ISS sobre este círculo. Sirve para mostrar
// "el anillo orbital real" visualmente, no para predecir la trayectoria.
function computeOrbitRing(lat: number, lon: number, altitudeM: number): Cesium.Cartesian3[] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = EARTH_RADIUS_M + altitudeM;

  const P = new Cesium.Cartesian3(
    Math.cos(toRad(lat)) * Math.cos(toRad(lon)),
    Math.cos(toRad(lat)) * Math.sin(toRad(lon)),
    Math.sin(toRad(lat))
  );
  const pole = new Cesium.Cartesian3(0, 0, 1);

  const poleDotP = Cesium.Cartesian3.dot(pole, P);
  const Q = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(pole, Cesium.Cartesian3.multiplyByScalar(P, poleDotP, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  const R = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(P, pole, new Cesium.Cartesian3()), new Cesium.Cartesian3());

  const qDotPole = Cesium.Cartesian3.dot(Q, pole);
  const sinInclination = Math.sin(toRad(ISS_INCLINATION_DEG));
  const b = qDotPole !== 0 ? sinInclination / qDotPole : 0;
  const c = Math.sqrt(Math.max(0, 1 - b * b));

  const N = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.add(Cesium.Cartesian3.multiplyByScalar(Q, b, new Cesium.Cartesian3()), Cesium.Cartesian3.multiplyByScalar(R, c, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  const NxP = Cesium.Cartesian3.cross(N, P, new Cesium.Cartesian3());

  const points: Cesium.Cartesian3[] = [];
  for (let deg = 0; deg <= 360; deg += 4) {
    const theta = toRad(deg);
    const dir = Cesium.Cartesian3.add(
      Cesium.Cartesian3.multiplyByScalar(P, Math.cos(theta), new Cesium.Cartesian3()),
      Cesium.Cartesian3.multiplyByScalar(NxP, Math.sin(theta), new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    points.push(Cesium.Cartesian3.multiplyByScalar(dir, r, new Cesium.Cartesian3()));
  }
  return points;
}

const AQI_COLORS: Record<string, string> = {
  good: "#10b981",
  moderate: "#f59e0b",
  unhealthy: "#f97316",
  hazardous: "#ef4444",
};

export default function GlobeContainer({
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
  selectedEarthquakeId,
  initialView = DEFAULT_MAP_VIEW,
  theme,
}: GlobeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const onSelectEarthquakeRef = useRef(onSelectEarthquake);
  onSelectEarthquakeRef.current = onSelectEarthquake;

  // Refs con los datos más recientes: el click handler y el popup se
  // registran una sola vez en el effect de inicialización, así que necesitan
  // leer siempre el estado más reciente (mismo patrón que MapContainer.tsx).
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

  // Popup flotante estilo glass para el globo 3D (infoBox nativo de Cesium
  // está desactivado a propósito, ver comentario en el Viewer más abajo).
  const [popupInfo, setPopupInfo] = useState<{ entityId: string; html: string } | null>(null);
  const popupInfoRef = useRef(popupInfo);
  popupInfoRef.current = popupInfo;
  const popupElRef = useRef<HTMLDivElement>(null);

  // Construye el HTML interno del popup para un id de entidad dado,
  // replicando EXACTAMENTE el contenido/orden/labels de los popups 2D en
  // MapContainer.tsx (misma plantilla glass, mismos campos por capa).
  function buildPopupHtml(entityId: string): string | null {
    if (entityId.startsWith("eq-")) {
      const targetId = entityId.slice(3);
      const f = earthquakesRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { mag, place, time, updated } = f.properties;
      const depth = f.geometry.coordinates[2] ?? 0;
      const dateStr = new Date(Number(time)).toLocaleString();
      const updatedStr = new Date(Number(updated)).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-rose-400 text-sm">Sismo M ${mag ?? "N/D"}</span>
          <span class="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">USGS</span>
        </div>
        <div class="text-[var(--ds-text-primary)] font-medium leading-snug">${place}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Profundidad: ${depth} km</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Ocurrió: ${dateStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
      </div>`;
    }

    if (entityId.startsWith("fire-")) {
      const targetId = entityId.slice(5);
      const f = firesRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { frp, confidence, satellite, acquiredAt } = f.properties;
      const dateStr = new Date(acquiredAt).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-orange-400 text-sm">🔥 Incendio activo</span>
          <span class="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">${satellite}</span>
        </div>
        <div class="text-[var(--ds-text-secondary)]">FRP: <span class="font-bold text-[var(--ds-text-primary)]">${frp} MW</span></div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Confianza: ${confidence}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${dateStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: NASA FIRMS</div>
      </div>`;
    }

    if (entityId.startsWith("aqm-")) {
      const targetId = entityId.slice(4);
      const f = airQualityModelRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { city, pm25, category, updated } = f.properties;
      const updatedStr = new Date(updated).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-cyan-400 text-sm">Aire (modelo)</span>
          <span class="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded">${category}</span>
        </div>
        <div class="text-[var(--ds-text-primary)] font-medium">${city}</div>
        <div class="text-[var(--ds-text-secondary)]">PM2.5: <span class="font-bold text-[var(--ds-text-primary)]">${pm25} µg/m³</span></div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Estimado por Open-Meteo, no observado directamente</div>
      </div>`;
    }

    if (entityId.startsWith("aq-")) {
      const targetId = entityId.slice(3);
      const f = airQualityRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { station, pm25, category, updated } = f.properties;
      const updatedStr = new Date(updated).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-emerald-400 text-sm">Calidad del Aire</span>
          <span class="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">${category}</span>
        </div>
        <div class="text-[var(--ds-text-primary)] font-medium">${station}</div>
        <div class="text-[var(--ds-text-secondary)]">PM2.5: <span class="font-bold text-[var(--ds-text-primary)]">${pm25} µg/m³</span></div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: OpenAQ</div>
      </div>`;
    }

    if (entityId.startsWith("weather-")) {
      const targetId = entityId.slice(8);
      const f = weatherRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { city, temperature, humidity, windSpeed, weatherDescription, updated } = f.properties;
      const updatedStr = new Date(updated).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-sky-400 text-sm">${city}</span>
          <span class="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">${weatherDescription}</span>
        </div>
        <div class="text-[var(--ds-text-secondary)]">Temperatura: <span class="font-bold text-[var(--ds-text-primary)]">${temperature}°C</span></div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Humedad: ${humidity}% · Viento: ${windSpeed} km/h</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${updatedStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: Open-Meteo</div>
      </div>`;
    }

    if (entityId.startsWith("disaster-")) {
      const targetId = entityId.slice(9);
      const f = disastersRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { name, eventTypeLabel, country, alertLevel, fromDate, toDate, reportUrl } = f.properties;
      const fromStr = fromDate ? new Date(fromDate).toLocaleString() : "N/D";
      const toStr = toDate ? new Date(toDate).toLocaleString() : "en curso";
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-amber-400 text-sm">${eventTypeLabel}</span>
          <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${alertLevel === "Red" ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}">${alertLevel}</span>
        </div>
        <div class="text-[var(--ds-text-primary)] font-medium leading-snug">${name}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">${country}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Desde: ${fromStr} · Hasta: ${toStr}</div>
        <a href="${reportUrl}" target="_blank" rel="noopener noreferrer" class="text-amber-400 text-[10px] underline">Ver reporte GDACS</a>
      </div>`;
    }

    if (entityId.startsWith("volcano-")) {
      const targetId = entityId.slice(8);
      const f = volcanoesRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      const { name, country, volcanoType, lastEruptionYear, elevationM } = f.properties;
      const eruptionText =
        lastEruptionYear === null
          ? "Sin fecha documentada"
          : lastEruptionYear < 0
            ? `${Math.abs(lastEruptionYear)} a.C.`
            : `${lastEruptionYear} d.C.`;
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-amber-600 text-sm">🌋 ${name}</span>
          <span class="text-[10px] bg-amber-700/20 text-amber-600 px-1.5 py-0.5 rounded">${volcanoType}</span>
        </div>
        <div class="text-[var(--ds-text-primary)] font-medium">${country}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última erupción conocida: ${eruptionText}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Elevación: ${elevationM ?? "N/D"} m</div>
        <div class="text-[var(--ds-text-muted)] text-[10px] italic pt-0.5 border-t [border-color:var(--ds-glass-border)]">Catálogo histórico (GVP) — no es monitoreo en tiempo real</div>
      </div>`;
    }

    if (entityId === "iss") {
      const f = issRef.current.features[0];
      if (!f) return null;
      const { altitudeKm, velocityKmS, timestamp } = f.properties;
      const dateStr = new Date(timestamp).toLocaleString();
      return `<div class="space-y-1.5 p-1 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="font-bold text-[var(--ds-text-primary)] text-sm">🛰️ Estación Espacial Internacional</span>
        </div>
        <div class="text-[var(--ds-text-secondary)]">Altitud: <span class="font-bold text-[var(--ds-text-primary)]">${altitudeKm.toFixed(1)} km</span></div>
        <div class="text-[var(--ds-text-secondary)]">Velocidad: <span class="font-bold text-[var(--ds-text-primary)]">${velocityKmS.toFixed(2)} km/s</span></div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Última actualización: ${dateStr}</div>
        <div class="text-[var(--ds-text-muted)] text-[10px]">Fuente: NASA (trayectoria OEM)</div>
      </div>`;
    }

    return null;
  }

  // 1. Inicialización única del Viewer (igual que MapContainer: se crea una
  // sola vez, los cambios posteriores de datos/tema se aplican en effects
  // separados sin recrear el globo).
  useEffect(() => {
    if (!containerRef.current) return;

    (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";

    const token = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
    if (token) Cesium.Ion.defaultAccessToken = token;

    const viewer = new Cesium.Viewer(containerRef.current, {
      // El default de Viewer (ImageryLayer.fromWorldImagery(), respaldado
      // por Bing) pega directo a dev.virtualearth.net con una key demo de
      // Cesium, fuera del proxy de Ion — choca contra la CSP del proyecto y
      // no usa el token propio. Se desactiva acá y se agrega explícitamente
      // vía Ion más abajo (createWorldImageryAsync).
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      shouldAnimate: true,
      // preserveDrawingBuffer: true evita que Chromium capture un buffer en
      // blanco/negro al hacer el snapshot para backdrop-filter (blur) de los
      // paneles glass que flotan sobre el canvas WebGL del globo. Mismo fix
      // que en MapContainer.tsx (MapLibre) para el mapa 2D.
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true,
        },
      },
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    // Nota: el crédito/atribución de Cesium Ion (esquina inferior) se deja
    // visible a propósito — es requisito de los términos de uso de Ion al
    // consumir su terreno/imagería, no se debe ocultar.

    Cesium.createWorldTerrainAsync()
      .then((terrainProvider) => {
        if (!viewer.isDestroyed()) viewer.scene.terrainProvider = terrainProvider;
      })
      .catch((err) => console.error("Error cargando terreno de Cesium Ion:", err));

    // Imagería explícita vía Ion (World Imagery / Bing Aerial, assetId 2) —
    // no se deja el default implícito del Viewer, que en esta versión
    // dispara una llamada a dev.virtualearth.net fuera del proxy de Ion y
    // choca contra la CSP del proyecto.
    Cesium.createWorldImageryAsync()
      .then((imageryProvider) => {
        if (viewer.isDestroyed()) return;
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(imageryProvider);
      })
      .catch((err) => console.error("Error cargando imagería de Cesium Ion:", err));

    const finalAltitude = zoomToAltitude(initialView.lat, initialView.zoom);
    const finalDestination = Cesium.Cartesian3.fromDegrees(initialView.lng, initialView.lat, finalAltitude);

    // Cinemática de entrada: solo la primera vez por sesión (sessionStorage,
    // no localStorage — vuelve a jugarse en pestañas/sesiones nuevas) y solo
    // si el usuario no pidió reduced-motion. Se puede omitir con click o Esc.
    let alreadySeen = true;
    try {
      alreadySeen = sessionStorage.getItem("ecopulse-intro-seen") === "true";
    } catch {
      // sessionStorage bloqueado (modo privado) — se degrada sin cinemática.
    }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: no-preference)").matches === false;
    const shouldPlayIntro = !alreadySeen && !prefersReducedMotion;

    try {
      sessionStorage.setItem("ecopulse-intro-seen", "true");
    } catch {
      // Ver comentario de arriba.
    }

    let introKeyHandler: ((e: KeyboardEvent) => void) | null = null;
    let introSkipHandler: (() => void) | null = null;

    if (shouldPlayIntro) {
      // Punto de partida "desde el espacio": misma longitud/latitud, bastante
      // más lejos que el destino final (que ya de por sí puede ser una
      // altitud grande si el zoom inicial es muy alejado — de ahí el
      // múltiplo en vez de una constante fija, para garantizar que el punto
      // de partida SIEMPRE esté más lejos que el final). Instantáneo (sin
      // animación) — la animación real es el flyTo de abajo.
      const introStartAltitude = Math.max(finalAltitude * 6, 20000000);
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(initialView.lng, initialView.lat, introStartAltitude),
      });

      const skipIntro = () => {
        viewer.camera.cancelFlight();
        viewer.camera.setView({ destination: finalDestination });
        if (introKeyHandler) window.removeEventListener("keydown", introKeyHandler);
        viewer.scene.canvas.removeEventListener("pointerdown", skipIntro);
      };
      introSkipHandler = skipIntro;
      introKeyHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") skipIntro();
      };
      window.addEventListener("keydown", introKeyHandler);
      viewer.scene.canvas.addEventListener("pointerdown", skipIntro, { once: true });

      viewer.camera.flyTo({
        destination: finalDestination,
        duration: 2.5,
        complete: () => {
          if (introKeyHandler) window.removeEventListener("keydown", introKeyHandler);
        },
      });
    } else {
      viewer.camera.flyTo({ destination: finalDestination, duration: 0 });
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const id = picked?.id?.id as string | undefined;

      if (!id) {
        // Click en espacio vacío del globo: cierra el popup, si hay uno abierto.
        setPopupInfo(null);
        return;
      }

      if (id.startsWith("eq-")) {
        // Los sismos mantienen su comportamiento previo (selección para el
        // panel lateral de tendencia) Y además ahora abren el popup, igual
        // que en 2D (que hace ambas cosas en el mismo click).
        onSelectEarthquakeRef.current?.(id.slice(3));
      }

      if (id === "iss-orbit") {
        // El anillo orbital de la ISS no tiene datos propios que mostrar —
        // se ignora el click para no abrir/cerrar el popup accidentalmente.
        return;
      }

      const html = buildPopupHtml(id);
      if (html) {
        setPopupInfo({ entityId: id, html });
      } else {
        setPopupInfo(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Ancla el popup DOM a la posición en pantalla de la entidad seleccionada
    // en cada frame — patrón estándar de Cesium para pinear overlays HTML a
    // un punto 3D que se mueve mientras la cámara orbita/paneal/hace zoom.
    // Se oculta solo (sin desmontar el popup ni perder su contenido) cuando
    // la entidad queda del lado oculto del globo o fuera de pantalla.
    const positionPopup = () => {
      const info = popupInfoRef.current;
      const el = popupElRef.current;
      if (!info || !el) return;

      const entity = viewer.entities.getById(info.entityId);
      const position = entity?.position?.getValue(viewer.clock.currentTime);
      if (!entity || !position) {
        el.style.display = "none";
        return;
      }

      const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
      if (!windowPosition) {
        el.style.display = "none";
        return;
      }

      // Entidad detrás del globo: compara la normal de la superficie en ese
      // punto contra la dirección cámara->punto — si apuntan "para el mismo
      // lado" el punto está del lado oculto de la esfera desde la cámara
      // actual (aproximación geométrica estándar, equivalente en la
      // práctica a un chequeo de oclusión por el elipsoide).
      const ellipsoid = viewer.scene.globe.ellipsoid;
      const surfaceNormal = ellipsoid.geodeticSurfaceNormal(position, new Cesium.Cartesian3());
      const cameraToPoint = Cesium.Cartesian3.subtract(position, viewer.camera.positionWC, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(cameraToPoint, cameraToPoint);
      if (surfaceNormal && Cesium.Cartesian3.dot(surfaceNormal, cameraToPoint) > 0) {
        el.style.display = "none";
        return;
      }

      el.style.display = "block";
      el.style.left = `${windowPosition.x}px`;
      el.style.top = `${windowPosition.y}px`;
      // Si no hay espacio arriba del punto para el popup (viewport corto o
      // punto cerca del borde superior del canvas), se voltea para
      // renderizar debajo — mismo comportamiento de auto-flip que ya trae
      // maplibre-gl de fábrica en los popups 2D.
      const estimatedHeight = el.offsetHeight || 160;
      const shouldFlip = windowPosition.y - estimatedHeight - 14 < 0;
      el.classList.toggle("cesium-glass-popup-flip", shouldFlip);
    };
    viewer.scene.postRender.addEventListener(positionPopup);

    viewerRef.current = viewer;

    return () => {
      if (introKeyHandler) window.removeEventListener("keydown", introKeyHandler);
      if (introSkipHandler) viewer.scene.canvas.removeEventListener("pointerdown", introSkipHandler);
      viewer.scene.postRender.removeEventListener(positionPopup);
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Color de fondo segun tema (no recrea el viewer).
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.backgroundColor =
      theme === "dark"
        ? Cesium.Color.fromCssColorString("#0b0e14")
        : Cesium.Color.fromCssColorString("#f8fafc");
  }, [theme]);

  // 3. Renderizado de las 8 capas como entidades. Se limpian y re-crean en
  // cada cambio de datos/visibilidad — mismo enfoque que el ejemplo de
  // referencia, simple y suficiente para el volumen de datos del proyecto.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    if (showQuakes) {
      earthquakes.features.forEach((f) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const mag = f.properties.mag ?? 0;
        const isSelected = String(f.id) === selectedEarthquakeId;
        viewer.entities.add({
          id: `eq-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: isSelected ? 16 : 6 + mag * 2,
            color: Cesium.Color.fromCssColorString(isSelected ? "#6366f1" : "#10b981").withAlpha(0.85),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: isSelected ? 2 : 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          description: `M ${mag} — ${f.properties.place} (${depth ?? 0} km)`,
        });
      });
    }

    if (showFires) {
      // FIRMS trae filas casi-duplicadas (mismo hallazgo que ya forzó
      // dedupeByKey() en la ingesta 2D) — sin esto, viewer.entities.add()
      // lanza DeveloperError por id repetido y crashea el globo entero.
      dedupeByKey(fires.features, "id").forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        viewer.entities.add({
          id: `fire-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 4 + Math.min(f.properties.frp, 40) / 4,
            color: Cesium.Color.fromCssColorString("#f97316").withAlpha(0.85),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    }

    if (showAirQuality) {
      airQuality.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        viewer.entities.add({
          id: `aq-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString(AQI_COLORS[f.properties.category]).withAlpha(0.85),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    }

    if (showAirQualityModel) {
      airQualityModel.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const category = getAQICategory(f.properties.pm25);
        viewer.entities.add({
          id: `aqm-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 8,
            color: Cesium.Color.TRANSPARENT,
            outlineColor: Cesium.Color.fromCssColorString(AQI_COLORS[category]),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    }

    if (showWeather) {
      weather.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        viewer.entities.add({
          id: `weather-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: { pixelSize: 5, color: Cesium.Color.fromCssColorString("#38bdf8"), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: {
            text: `${Math.round(f.properties.temperature)}°C`,
            font: "11px sans-serif",
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    }

    if (showDisasters) {
      disasters.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const color = f.properties.alertLevel === "Red" ? "#ef4444" : f.properties.alertLevel === "Orange" ? "#f59e0b" : "#10b981";
        viewer.entities.add({
          id: `disaster-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: { pixelSize: 10, color: Cesium.Color.fromCssColorString(color).withAlpha(0.85), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        });
      });
    }

    if (showVolcanoes) {
      volcanoes.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        viewer.entities.add({
          id: `volcano-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: { pixelSize: 6, color: Cesium.Color.fromCssColorString("#a16207").withAlpha(0.85), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
        });
      });
    }

    if (showIss && iss.features[0]) {
      const issFeature = iss.features[0];
      const [lon, lat] = issFeature.geometry.coordinates;
      const altitudeM = issFeature.properties.altitudeKm * 1000;

      viewer.entities.add({
        id: "iss",
        position: Cesium.Cartesian3.fromDegrees(lon, lat, altitudeM),
        point: { pixelSize: 10, color: Cesium.Color.fromCssColorString("#f472b6"), outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
        label: {
          text: "ISS",
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
        },
      });

      viewer.entities.add({
        id: "iss-orbit",
        polyline: {
          positions: computeOrbitRing(lat, lon, altitudeM),
          width: 1,
          material: Cesium.Color.fromCssColorString("#f472b6").withAlpha(0.35),
        },
      });
    }

    // Si el popup abierto pertenece a una entidad que ya no existe (capa
    // ocultada, o su feature desapareció de los datos), se cierra. Si sigue
    // existiendo pero sus datos cambiaron (típicamente la ISS, que llega por
    // poll en vivo), se refresca el contenido para no mostrar valores viejos.
    if (popupInfoRef.current) {
      const currentId = popupInfoRef.current.entityId;
      const stillExists = !!viewer.entities.getById(currentId);
      if (!stillExists) {
        setPopupInfo(null);
      } else {
        const refreshedHtml = buildPopupHtml(currentId);
        if (refreshedHtml && refreshedHtml !== popupInfoRef.current.html) {
          setPopupInfo({ entityId: currentId, html: refreshedHtml });
        }
      }
    }
  }, [
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
    selectedEarthquakeId,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {popupInfo && (
        <div ref={popupElRef} className="cesium-glass-popup" style={{ display: "none" }}>
          <button
            type="button"
            aria-label="Cerrar"
            className="cesium-glass-popup-close"
            onClick={() => setPopupInfo(null)}
          >
            ×
          </button>
          <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} />
        </div>
      )}
    </div>
  );
}
