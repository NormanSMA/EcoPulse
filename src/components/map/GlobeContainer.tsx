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
import { themes, layers, marker, magnitudeColor, alertColor, aqiColor } from "@/design-system/tokens";
import {
  earthquakePopup,
  airQualityPopup,
  firePopup,
  weatherPopup,
  disasterPopup,
  issPopup,
  volcanoPopup,
  airQualityModelPopup,
  popupCloseLabel,
} from "@/lib/popupHtml";

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
  focus?: { lng: number; lat: number; key: number } | null;
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
  focus,
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
      const depth = f.geometry.coordinates[2] ?? 0;
      return earthquakePopup(f.properties, depth);
    }

    if (entityId.startsWith("fire-")) {
      const targetId = entityId.slice(5);
      const f = firesRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return firePopup(f.properties);
    }

    if (entityId.startsWith("aqm-")) {
      const targetId = entityId.slice(4);
      const f = airQualityModelRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return airQualityModelPopup(f.properties, f.properties.category);
    }

    if (entityId.startsWith("aq-")) {
      const targetId = entityId.slice(3);
      const f = airQualityRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return airQualityPopup(f.properties);
    }

    if (entityId.startsWith("weather-")) {
      const targetId = entityId.slice(8);
      const f = weatherRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return weatherPopup(f.properties);
    }

    if (entityId.startsWith("disaster-")) {
      const targetId = entityId.slice(9);
      const f = disastersRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return disasterPopup(f.properties);
    }

    if (entityId.startsWith("volcano-")) {
      const targetId = entityId.slice(8);
      const f = volcanoesRef.current.features.find((ft) => String(ft.id) === targetId);
      if (!f) return null;
      return volcanoPopup(f.properties);
    }

    if (entityId === "iss") {
      const f = issRef.current.features[0];
      if (!f) return null;
      return issPopup(f.properties);
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
      fullscreenButton: false,
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

  // 1b. Centrar en un evento seleccionado desde la lista.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !focus) return;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(focus.lng, focus.lat, 2500000), duration: 1.5 });
  }, [focus]);

  // 2. Color de fondo segun tema (no recrea el viewer).
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.backgroundColor =
      theme === "dark"
        ? Cesium.Color.fromCssColorString(themes.dark.canvas)
        : Cesium.Color.fromCssColorString(themes.light.canvas);
  }, [theme]);

  // 3. Renderizado por capa. Cada capa tiene su propio effect y solo
  // re-crea SUS entidades cuando cambian sus datos o su visibilidad (antes
  // un solo effect borraba y recreaba las 8 capas ante cualquier cambio —
  // incluido el poll de la ISS cada 15 s o seleccionar un sismo).
  const layerEntitiesRef = useRef<Record<string, Cesium.Entity[]>>({});
  const selectedRef = useRef(selectedEarthquakeId);
  selectedRef.current = selectedEarthquakeId;

  // Cierra o refresca el popup abierto si su entidad desapareció o cambió
  // (típicamente la ISS, que llega por poll en vivo).
  function syncPopup(viewer: Cesium.Viewer) {
    const info = popupInfoRef.current;
    if (!info) return;
    if (!viewer.entities.getById(info.entityId)) {
      setPopupInfo(null);
      return;
    }
    const refreshedHtml = buildPopupHtml(info.entityId);
    if (refreshedHtml && refreshedHtml !== info.html) {
      setPopupInfo({ entityId: info.entityId, html: refreshedHtml });
    }
  }

  function replaceLayer(
    key: string,
    visible: boolean,
    build: (add: (e: Cesium.Entity.ConstructorOptions) => void) => void
  ) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.suspendEvents();
    (layerEntitiesRef.current[key] ?? []).forEach((e) => viewer.entities.remove(e));
    const added: Cesium.Entity[] = [];
    if (visible) build((opts) => added.push(viewer.entities.add(opts)));
    layerEntitiesRef.current[key] = added;
    viewer.entities.resumeEvents();
    syncPopup(viewer);
  }

  // Estilo del sismo seleccionado: se aplica solo a la entidad afectada.
  function styleQuake(id: string | null, selected: boolean) {
    const viewer = viewerRef.current;
    if (!viewer || !id) return;
    const entity = viewer.entities.getById(`eq-${id}`);
    const f = earthquakesRef.current.features.find((ft) => String(ft.id) === id);
    if (!entity?.point || !f) return;
    const mag = f.properties.mag ?? 0;
    entity.point.pixelSize = new Cesium.ConstantProperty(selected ? 16 : 6 + mag * 2);
    entity.point.outlineColor = new Cesium.ConstantProperty(
      Cesium.Color.fromCssColorString(selected ? marker.selected : marker.stroke)
    );
    entity.point.outlineWidth = new Cesium.ConstantProperty(selected ? 3 : 1);
  }

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    styleQuake(prevSelectedRef.current, false);
    styleQuake(selectedEarthquakeId ?? null, true);
    prevSelectedRef.current = selectedEarthquakeId ?? null;
  }, [selectedEarthquakeId]);

  useEffect(() => {
    replaceLayer("quakes", showQuakes, (add) => {
      earthquakes.features.forEach((f) => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const mag = f.properties.mag ?? 0;
        add({
          id: `eq-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 6 + mag * 2,
            color: Cesium.Color.fromCssColorString(magnitudeColor(mag)).withAlpha(0.9),
            outlineColor: Cesium.Color.fromCssColorString(marker.stroke),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          description: `M ${mag} — ${f.properties.place} (${depth ?? 0} km)`,
        });
      });
    });
    styleQuake(selectedRef.current ?? null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earthquakes, showQuakes]);

  useEffect(() => {
    // FIRMS trae filas casi-duplicadas — sin dedupe, entities.add() lanza
    // DeveloperError por id repetido y crashea el globo entero.
    replaceLayer("fires", showFires, (add) => {
      dedupeByKey(fires.features, "id").forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `fire-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 4 + Math.min(f.properties.frp, 40) / 4,
            color: Cesium.Color.fromCssColorString(layers.fires).withAlpha(0.85),
            outlineColor: Cesium.Color.fromCssColorString(marker.fireStroke),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fires, showFires]);

  useEffect(() => {
    replaceLayer("aq", showAirQuality, (add) => {
      airQuality.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `aq-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString(aqiColor(f.properties.category)).withAlpha(0.85),
            outlineColor: Cesium.Color.fromCssColorString(marker.stroke),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airQuality, showAirQuality]);

  useEffect(() => {
    replaceLayer("aqm", showAirQualityModel, (add) => {
      airQualityModel.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const category = getAQICategory(f.properties.pm25);
        add({
          id: `aqm-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 8,
            color: Cesium.Color.TRANSPARENT,
            outlineColor: Cesium.Color.fromCssColorString(aqiColor(category)),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airQualityModel, showAirQualityModel]);

  useEffect(() => {
    replaceLayer("weather", showWeather, (add) => {
      weather.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `weather-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: { pixelSize: 5, color: Cesium.Color.fromCssColorString(layers.weather), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
          label: {
            text: `${Math.round(f.properties.temperature)}°C`,
            font: "500 11px 'Google Sans Flex', Roboto, sans-serif",
            fillColor: Cesium.Color.fromCssColorString(marker.weatherText),
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.fromCssColorString(marker.halo),
            pixelOffset: new Cesium.Cartesian2(0, -16),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, showWeather]);

  useEffect(() => {
    replaceLayer("disasters", showDisasters, (add) => {
      disasters.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `disaster-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString(alertColor(f.properties.alertLevel)).withAlpha(0.85),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disasters, showDisasters]);

  useEffect(() => {
    replaceLayer("volcanoes", showVolcanoes, (add) => {
      volcanoes.features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `volcano-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(layers.volcanoes).withAlpha(0.85),
            outlineColor: Cesium.Color.fromCssColorString(marker.volcanoStroke),
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volcanoes, showVolcanoes]);

  useEffect(() => {
    const issFeature = iss.features[0];
    replaceLayer("iss", showIss && !!issFeature, (add) => {
      const [lon, lat] = issFeature.geometry.coordinates;
      const altitudeM = issFeature.properties.altitudeKm * 1000;
      add({
        id: "iss",
        position: Cesium.Cartesian3.fromDegrees(lon, lat, altitudeM),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString(marker.issFill),
          outlineColor: Cesium.Color.fromCssColorString(marker.issStroke),
          outlineWidth: 2,
        },
        label: {
          text: "ISS",
          font: "500 12px 'Google Sans Flex', Roboto, sans-serif",
          fillColor: Cesium.Color.fromCssColorString(marker.labelText),
          outlineColor: Cesium.Color.fromCssColorString(marker.halo),
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          backgroundPadding: new Cesium.Cartesian2(8, 4),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString(themes.dark.surface).withAlpha(0.85),
        },
      });
      add({
        id: "iss-orbit",
        polyline: {
          positions: computeOrbitRing(lat, lon, altitudeM),
          width: 1,
          material: Cesium.Color.fromCssColorString(marker.issStroke).withAlpha(0.4),
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iss, showIss]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {popupInfo && (
        <div ref={popupElRef} className="cesium-glass-popup" style={{ display: "none" }}>
          <button
            type="button"
            aria-label={popupCloseLabel()}
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
