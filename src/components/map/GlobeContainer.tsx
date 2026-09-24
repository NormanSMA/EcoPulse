'use client';

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { dedupeByKey } from "@/lib/ingest";
import { DEFAULT_MAP_VIEW, altitudeToZoom, zoomToAltitude } from "@/lib/mapView";
import { themes, layers, marker, magnitudeColor, aqiColor, stormColor } from "@/design-system/tokens";
import { getIcon } from "@/lib/mapIcons";
import { selectionFromEntityId } from "@/lib/selection";
import type { MapViewProps } from "./types";

interface GlobeContainerProps extends MapViewProps {
  theme: "light" | "dark";
}

const HOUR_MS = 3_600_000;
// Los iconos de lib/mapIcons se dibujan a densidad 2x: Cesium los muestra a
// píxeles nativos, así que se escalan a la mitad y se achican con la distancia.
const ICON_SCALE = 0.5;
const ICON_BY_DISTANCE = new Cesium.NearFarScalar(1.5e6, 1, 2.5e7, 0.6);
// Iconos pegados al relieve real: a una altura fija quedaban enterrados en
// montañas más altas (volcanes andinos, Himalaya) al acercarse.
const GROUND = Cesium.HeightReference.CLAMP_TO_GROUND;
// Iconos y puntos sin prueba de profundidad: el relieve nunca los tapa (ni
// de cerca ni en mesetas altas vistas de lejos). Lo que queda detrás de la
// Tierra se oculta con un test de horizonte propio (ver aboveHorizon).
const NO_DEPTH_TEST = Number.POSITIVE_INFINITY;
const RADAR_MAX_LEVEL = 7;
// Un "tap" es pulsar y soltar sin arrastrar; el área de búsqueda del elemento
// tocado es mayor con el dedo que con el ratón.
const TAP_TOLERANCE_PX = 8;
const TAP_MAX_MS = 800;
const TOUCH_PICK_PX = 28;
const MOUSE_PICK_PX = 6;
const PICK_LIMIT = 8;

/** Opacidad por antigüedad, misma curva que el mapa 2D. */
function ageAlpha(refTime: number, t: number): number {
  const h = Math.max(0, (refTime - t) / HOUR_MS);
  const stops: [number, number][] = [[0, 0.95], [6, 0.8], [24, 0.5], [72, 0.3]];
  for (let i = 1; i < stops.length; i++) {
    const [h1, a1] = stops[i];
    const [h0, a0] = stops[i - 1];
    if (h <= h1) return a0 + ((a1 - a0) * (h - h0)) / (h1 - h0);
  }
  return 0.3;
}

/**
 * ¿Está `p` (sobre el elipsoide) por encima del horizonte visto desde la
 * cámara? En el espacio escalado del elipsoide es una esfera unitaria: el punto
 * se ve si la cámara queda por encima de su plano tangente (C·P > 1).
 */
function aboveHorizon(camera: Cesium.Cartesian3, p: Cesium.Cartesian3): boolean {
  const r = Cesium.Ellipsoid.WGS84.oneOverRadii;
  const px = p.x * r.x, py = p.y * r.y, pz = p.z * r.z;
  const len2 = px * px + py * py + pz * pz;
  return camera.x * r.x * px + camera.y * r.y * py + camera.z * r.z * pz > len2;
}

const css = (c: string) => Cesium.Color.fromCssColorString(c);
const LABEL_FONT = "600 12px 'Google Sans Flex', Roboto, sans-serif";

export default function GlobeContainer(props: GlobeContainerProps) {
  const { data, visibility, refTime, radarTiles, selectedPoint, focus, theme, initialView = DEFAULT_MAP_VIEW } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Entidades por capa (iconos, trayectorias) y colecciones de primitivas
  // para las capas masivas (sismos, incendios, aire: hasta ~10.000 puntos).
  const layerEntitiesRef = useRef<Record<string, Cesium.Entity[]>>({});
  // Iconos anclados al terreno y su posición: se ocultan tras el horizonte
  // junto con los puntos (la prueba de profundidad deja asomar lo que está
  // justo detrás del borde del globo). Se recalcula al mover la cámara o al
  // cambiar los datos.
  const groundedRef = useRef(new Map<Cesium.Entity, Cesium.Cartesian3>());
  const horizonDirtyRef = useRef(true);
  const pointsRef = useRef<Record<string, Cesium.PointPrimitiveCollection>>({});
  const radarLayerRef = useRef<Cesium.ImageryLayer | null>(null);

  // 1. Inicialización única del Viewer.
  useEffect(() => {
    if (!containerRef.current) return;
    (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium/";
    const token = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
    if (token) Cesium.Ion.defaultAccessToken = token;

    const viewer = new Cesium.Viewer(containerRef.current, {
      // Sin la capa base por defecto (Bing directo a dev.virtualearth.net,
      // fuera del proxy de Ion y de la CSP): se agrega vía Ion más abajo.
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
      shouldAnimate: false,
      // Evita que el snapshot para backdrop-filter de los paneles salga negro.
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });

    viewer.scene.globe.enableLighting = propsRef.current.visibility.dayNight;
    viewer.scene.globe.showGroundAtmosphere = true;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(propsRef.current.refTime));
    // Los créditos de Cesium Ion se dejan visibles: lo exigen sus términos.

    Cesium.createWorldTerrainAsync()
      .then((terrain) => {
        if (!viewer.isDestroyed()) viewer.scene.terrainProvider = terrain;
      })
      .catch((err) => console.error("Error cargando terreno de Cesium Ion:", err));
    Cesium.createWorldImageryAsync()
      .then((imagery) => {
        // Índice 0: la imagería base siempre queda debajo del radar.
        if (!viewer.isDestroyed()) viewer.imageryLayers.addImageryProvider(imagery, 0);
      })
      .catch((err) => console.error("Error cargando imagería de Cesium Ion:", err));

    for (const key of ["air", "fires", "quakes", "volcanoCatalog"]) {
      pointsRef.current[key] = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    }

    // Cámara inicial; cinemática de entrada una vez por sesión (se omite
    // con click o Esc, y con prefers-reduced-motion).
    const canvas = viewer.scene.canvas;
    const finalAltitude = zoomToAltitude(initialView.lat, initialView.zoom, canvas.clientWidth, canvas.clientHeight);
    const finalDestination = Cesium.Cartesian3.fromDegrees(initialView.lng, initialView.lat, finalAltitude);
    let alreadySeen = true;
    try {
      alreadySeen = sessionStorage.getItem("ecopulse-intro-seen") === "true";
      sessionStorage.setItem("ecopulse-intro-seen", "true");
    } catch {
      // sessionStorage bloqueado (modo privado): sin cinemática.
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let skipIntro: (() => void) | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipIntro?.();
    };
    if (!alreadySeen && !reduceMotion) {
      viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(initialView.lng, initialView.lat, Math.max(finalAltitude * 6, 2e7)) });
      skipIntro = () => {
        viewer.camera.cancelFlight();
        viewer.camera.setView({ destination: finalDestination });
        window.removeEventListener("keydown", onKey);
        viewer.scene.canvas.removeEventListener("pointerdown", skipIntro!);
      };
      window.addEventListener("keydown", onKey);
      viewer.scene.canvas.addEventListener("pointerdown", skipIntro, { once: true });
      viewer.camera.flyTo({ destination: finalDestination, duration: 2.5, complete: () => window.removeEventListener("keydown", onKey) });
    } else {
      viewer.camera.setView({ destination: finalDestination });
    }

    // Tap/click: elemento → misma selección que el mapa 2D; globo vacío →
    // punto. Se detecta con eventos de puntero propios (el LEFT_CLICK de
    // Cesium no se dispara con toques en móvil) y, con el dedo, se busca en
    // un área mayor para que los puntos pequeños sean fáciles de tocar.
    const selectAt = (position: Cesium.Cartesian2, pickSize: number) => {
      // Todo lo que hay bajo el puntero, de arriba abajo: gana lo primero con
      // detalle propio (una trayectoria o un cono encima no tapan el sismo).
      const picked = viewer.scene.drillPick(position, PICK_LIMIT, pickSize, pickSize);
      for (const p of picked) {
        const raw = p?.id;
        const id: string | undefined = typeof raw === "string" ? raw : raw instanceof Cesium.Entity ? raw.id : undefined;
        const selection = id ? selectionFromEntityId(id) : null;
        if (selection) {
          propsRef.current.onSelect(selection);
          return;
        }
      }
      const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      propsRef.current.onSelect({ kind: "point", lon: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) });
    };
    // Duración medida con la marca de tiempo de los eventos (no con la hora
    // en que se procesan): con el hilo ocupado renderizando, el pointerup puede
    // atenderse tarde y un toque corto parecería largo.
    let tap: { id: number; x: number; y: number; t: number } | null = null;
    let pointersDown = 0;
    let touchTapHandled = false;
    const onPointerDown = (e: PointerEvent) => {
      pointersDown++;
      tap = pointersDown === 1 && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      pointersDown = Math.max(0, pointersDown - 1);
      const start = tap;
      tap = null;
      if (!start || start.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_TOLERANCE_PX || e.timeStamp - start.t > TAP_MAX_MS) return;
      const rect = canvas.getBoundingClientRect();
      touchTapHandled = e.pointerType === "touch";
      selectAt(new Cesium.Cartesian2(e.clientX - rect.left, e.clientY - rect.top), e.pointerType === "touch" ? TOUCH_PICK_PX : MOUSE_PICK_PX);
    };
    // Tras un toque el navegador emite un click "de compatibilidad" que caería
    // sobre la hoja de detalle recién abierta (y la cerraría): se cancela.
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchTapHandled) return;
      touchTapHandled = false;
      e.preventDefault();
    };
    const onPointerCancel = () => {
      pointersDown = 0;
      tap = null;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((move: { endPosition: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(move.endPosition);
      const raw = picked?.id;
      const id = typeof raw === "string" ? raw : raw instanceof Cesium.Entity ? raw.id : undefined;
      viewer.scene.canvas.style.cursor = id && selectionFromEntityId(id) ? "pointer" : "";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const grounded = groundedRef.current;
    const lastCamera = new Cesium.Cartesian3();
    viewer.scene.preRender.addEventListener(() => {
      const camera = viewer.camera.positionWC;
      if (!horizonDirtyRef.current && Cesium.Cartesian3.equalsEpsilon(camera, lastCamera, 0, 1)) return;
      Cesium.Cartesian3.clone(camera, lastCamera);
      horizonDirtyRef.current = false;
      grounded.forEach((position, entity) => {
        const visible = aboveHorizon(camera, position);
        if (entity.show !== visible) entity.show = visible;
      });
      for (const collection of Object.values(pointsRef.current)) {
        for (let i = 0; i < collection.length; i++) {
          const point = collection.get(i);
          const visible = aboveHorizon(camera, point.position);
          if (point.show !== visible) point.show = visible;
        }
      }
    });

    // Vista actual → zoom equivalente, para que el 2D abra en la misma región.
    viewer.camera.moveEnd.addEventListener(() => {
      const center = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
      if (!center) return;
      const c = Cesium.Cartographic.fromCartesian(center);
      const lat = Cesium.Math.toDegrees(c.latitude);
      propsRef.current.onViewChange?.({
        lng: Cesium.Math.toDegrees(c.longitude),
        lat,
        zoom: altitudeToZoom(lat, viewer.camera.positionCartographic.height, canvas.clientWidth, canvas.clientHeight),
      });
    });

    viewerRef.current = viewer;
    return () => {
      window.removeEventListener("keydown", onKey);
      handler.destroy();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("touchend", onTouchEnd);
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      pointsRef.current = {};
      layerEntitiesRef.current = {};
      grounded.clear();
      radarLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1b. Centrar en un elemento elegido desde la lista o el buscador.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !focus) return;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(focus.lng, focus.lat, 2500000), duration: 1.5 });
  }, [focus]);

  // 2. Color de fondo según tema.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.backgroundColor = css(theme === "dark" ? themes.dark.canvas : themes.light.canvas);
  }, [theme]);

  // ---------- Helpers de capas ----------
  function replaceEntities(key: string, show: boolean, build: (add: (e: Cesium.Entity.ConstructorOptions) => void) => void) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.suspendEvents();
    (layerEntitiesRef.current[key] ?? []).forEach((e) => {
      viewer.entities.remove(e);
      groundedRef.current.delete(e);
    });
    const added: Cesium.Entity[] = [];
    if (show) {
      build((opts) => {
        const entity = viewer.entities.add(opts);
        added.push(entity);
        const grounded = opts.billboard?.heightReference === GROUND || opts.point?.heightReference === GROUND;
        if (grounded && opts.position instanceof Cesium.Cartesian3) groundedRef.current.set(entity, opts.position);
      });
    }
    layerEntitiesRef.current[key] = added;
    horizonDirtyRef.current = true;
    viewer.entities.resumeEvents();
    viewer.scene.requestRender();
  }

  function replacePoints(key: string, show: boolean, build: (add: (o: Record<string, unknown>) => void) => void) {
    const collection = pointsRef.current[key];
    if (!collection) return;
    collection.removeAll();
    collection.show = show;
    if (show) build((opts) => collection.add(opts as never));
    horizonDirtyRef.current = true;
    viewerRef.current?.scene.requestRender();
  }

  const onPoint = (lon: number, lat: number) => Cesium.Cartesian3.fromDegrees(lon, lat, 0);

  // 3. Capas.
  useEffect(() => {
    replacePoints("quakes", visibility.earthquakes, (add) => {
      for (const f of data.earthquakes.features) {
        const [lon, lat] = f.geometry.coordinates;
        const mag = f.properties.mag ?? 0;
        add({
          id: `eq-${f.id}`,
          position: onPoint(lon, lat),
          pixelSize: 6 + mag * 2,
          color: css(magnitudeColor(mag)).withAlpha(ageAlpha(refTime, f.properties.time)),
          outlineColor: css(marker.stroke).withAlpha(ageAlpha(refTime, f.properties.time)),
          outlineWidth: 1,
          disableDepthTestDistance: NO_DEPTH_TEST,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.earthquakes, visibility.earthquakes]);

  useEffect(() => {
    // FIRMS trae filas casi duplicadas: sin dedupe se repiten ids.
    replacePoints("fires", visibility.fires, (add) => {
      for (const f of dedupeByKey(data.fires.features, "id")) {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `fire-${f.id}`,
          position: onPoint(lon, lat),
          // Finos y translúcidos: a escala global se leen como una mancha de
          // calor (como el heatmap del 2D) y se definen al acercarse.
          pixelSize: 3 + Math.min(f.properties.frp, 60) / 15,
          color: css(layers.fires).withAlpha(0.7),
          scaleByDistance: new Cesium.NearFarScalar(5e5, 1.8, 2e7, 0.7),
          disableDepthTestDistance: NO_DEPTH_TEST,
        });
      }
    });
     
  }, [data.fires, visibility.fires]);

  useEffect(() => {
    replacePoints("air", visibility.airQuality, (add) => {
      for (const f of data.airQuality.features) {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `aq-${f.id}`,
          position: onPoint(lon, lat),
          pixelSize: 5,
          color: css(aqiColor(f.properties.category)),
          outlineColor: css(marker.strokeDark),
          outlineWidth: 1,
          scaleByDistance: new Cesium.NearFarScalar(5e5, 1.6, 2e7, 0.8),
          disableDepthTestDistance: NO_DEPTH_TEST,
        });
      }
    });
     
  }, [data.airQuality, visibility.airQuality]);

  useEffect(() => {
    replacePoints("volcanoCatalog", visibility.volcanoCatalog && !!data.volcanoCatalog, (add) => {
      for (const f of data.volcanoCatalog?.features ?? []) {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `volcat-${f.id}`,
          position: onPoint(lon, lat),
          pixelSize: 5,
          color: css(layers.volcanoCatalog),
          outlineColor: css(marker.volcanoStroke),
          outlineWidth: 1,
          disableDepthTestDistance: NO_DEPTH_TEST,
        });
      }
    });
     
  }, [data.volcanoCatalog, visibility.volcanoCatalog]);

  const billboard = (image: string) => ({
    image: getIcon(image) ?? "",
    scale: ICON_SCALE,
    scaleByDistance: ICON_BY_DISTANCE,
    heightReference: GROUND,
    disableDepthTestDistance: NO_DEPTH_TEST,
  });
  // La etiqueta de la ISS va a altitud orbital (sin anclar ni test de horizonte).
  const label = (text: string, grounded = true) => ({
    text,
    font: LABEL_FONT,
    fillColor: css(marker.labelText),
    outlineColor: css(marker.halo),
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, 30),
    ...(grounded && { heightReference: GROUND, disableDepthTestDistance: NO_DEPTH_TEST }),
  });

  useEffect(() => {
    replaceEntities("disasters", visibility.disasters, (add) => {
      for (const f of data.disasters.features) {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `disaster-${f.properties.eventId}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: billboard(`ep-disaster-${f.properties.eventType}-${f.properties.alertLevel}`),
        });
      }
    });
     
  }, [data.disasters, visibility.disasters]);

  useEffect(() => {
    replaceEntities("volcanoes", visibility.volcanoes, (add) => {
      for (const f of data.volcanoes.features) {
        const [lon, lat] = f.geometry.coordinates;
        add({
          id: `vol-${f.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: billboard(f.properties.status === "new" ? "ep-volcano-new" : "ep-volcano-continuing"),
        });
      }
    });
     
  }, [data.volcanoes, visibility.volcanoes]);

  useEffect(() => {
    replaceEntities("cyclones", visibility.cyclones, (add) => {
      data.cyclones.features.forEach((f, i) => {
        const p = f.properties;
        if (f.geometry.type === "Polygon" && p.kind === "cone") {
          add({
            id: `cyc-geo-cone-${p.eventId}-${i}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(f.geometry.coordinates[0].flat()),
              material: css(marker.cone).withAlpha(0.12),
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
          });
        } else if (f.geometry.type === "LineString" && p.kind === "track") {
          const color = css(stormColor(p.category ?? "TS"));
          add({
            id: `cyc-geo-track-${p.eventId}-${i}`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),
              width: p.forecast ? 2.5 : 4,
              clampToGround: true,
              material: p.forecast ? new Cesium.PolylineDashMaterialProperty({ color, dashLength: 10 }) : color,
            },
          });
        } else if (f.geometry.type === "Point" && p.kind === "position") {
          const [lon, lat] = f.geometry.coordinates;
          add({
            id: `cyc-pos-${p.eventId}`,
            position: Cesium.Cartesian3.fromDegrees(lon, lat),
            billboard: billboard(`ep-cyclone-${p.category ?? "TS"}`),
            label: label(p.name),
          });
        }
      });
    });
     
  }, [data.cyclones, visibility.cyclones]);

  useEffect(() => {
    const f = data.iss.features[0];
    replaceEntities("iss", visibility.iss && !!f, (add) => {
      const [lon, lat] = f.geometry.coordinates;
      add({
        id: "iss",
        position: Cesium.Cartesian3.fromDegrees(lon, lat, f.properties.altitudeKm * 1000),
        billboard: { image: getIcon("ep-iss") ?? "", scale: ICON_SCALE, scaleByDistance: ICON_BY_DISTANCE },
        label: label("ISS", false),
      });
      // Trayectoria real (efemérides NASA) a la altitud orbital.
      const track = f.properties.track;
      if (!track) return;
      const toPositions = (pts: typeof track.past) => Cesium.Cartesian3.fromDegreesArrayHeights(pts.flatMap(([x, y, altKm]) => [x, y, altKm * 1000]));
      add({
        id: "iss-track-past",
        polyline: { positions: toPositions(track.past), width: 2, arcType: Cesium.ArcType.NONE, material: css(marker.issStroke).withAlpha(0.85) },
      });
      add({
        id: "iss-track-future",
        polyline: {
          positions: toPositions(track.future),
          width: 2,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.PolylineDashMaterialProperty({ color: css(marker.issStroke).withAlpha(0.6), dashLength: 12 }),
        },
      });
    });
     
  }, [data.iss, visibility.iss]);

  // Anillo de selección.
  useEffect(() => {
    replaceEntities("selection", !!selectedPoint, (add) => {
      const [lon, lat] = selectedPoint!;
      add({
        id: "selection-ring",
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 34,
          color: css(marker.selected).withAlpha(0.12),
          outlineColor: css(marker.selected),
          outlineWidth: 3,
          heightReference: GROUND,
          disableDepthTestDistance: NO_DEPTH_TEST,
        },
      });
    });
     
  }, [selectedPoint]);

  // 4. Radar de lluvia (RainViewer) como capa de imagería.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (radarLayerRef.current) {
      viewer.imageryLayers.remove(radarLayerRef.current, true);
      radarLayerRef.current = null;
    }
    if (!radarTiles || !visibility.radar) return;
    const layer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({ url: radarTiles, maximumLevel: RADAR_MAX_LEVEL, credit: "RainViewer" })
    );
    layer.alpha = 0.7;
    radarLayerRef.current = layer;
  }, [radarTiles, visibility.radar]);

  // 5. Tiempo de referencia: reloj (iluminación día/noche) y antigüedad.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(refTime));
    const quakes = pointsRef.current.quakes;
    if (quakes) {
      const byId = new Map(data.earthquakes.features.map((f) => [`eq-${f.id}`, f]));
      for (let i = 0; i < quakes.length; i++) {
        const p = quakes.get(i);
        const f = byId.get(p.id as string);
        if (!f) continue;
        const alpha = ageAlpha(refTime, f.properties.time);
        p.color = css(magnitudeColor(f.properties.mag ?? 0)).withAlpha(alpha);
        p.outlineColor = css(marker.stroke).withAlpha(alpha);
      }
    }
    viewer.scene.requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refTime]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer) viewer.scene.globe.enableLighting = visibility.dayNight;
  }, [visibility.dayNight]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
