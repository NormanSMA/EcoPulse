'use client';

import { useEffect, useRef } from "react";
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
      if (id && id.startsWith("eq-")) {
        onSelectEarthquakeRef.current?.(id.slice(3));
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;

    return () => {
      if (introKeyHandler) window.removeEventListener("keydown", introKeyHandler);
      if (introSkipHandler) viewer.scene.canvas.removeEventListener("pointerdown", introSkipHandler);
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

  return <div ref={containerRef} className="w-full h-full" />;
}
