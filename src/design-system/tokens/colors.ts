// Design System 4.0 — lenguaje visual basado en Google DeepMind / Weather Lab
// (superficies sólidas grafito, acentos azul Material 3, tipografía Google
// Sans Flex, controles tipo pill). Ver `Diseño sistema/Design System 4.0.md`.
//
// Este archivo es la ÚNICA fuente de colores hex de la app:
// - `themes`: superficies/texto/acento por tema. `theme.css` los expone como
//   variables CSS en formato de canales RGB ("168 199 250") para que Tailwind
//   pueda aplicar opacidad (`bg-ds-primary/10`). Mantener sincronizados.
// - `layers` / `scales`: colores de las capas de datos. Los consumen a la vez
//   MapLibre (2D), Cesium (3D), los popups, la leyenda y los toggles del panel,
//   así que un mismo dato se ve igual en todas partes.

export const themes = {
  dark: {
    canvas: "#121317",
    surface: "#18191d",
    surfaceContainer: "#1f2024",
    surfaceContainerHigh: "#282a2e",
    surfaceContainerHighest: "#2f3034",
    textPrimary: "#f8f9fc",
    textSecondary: "#b2bbc5",
    textMuted: "#80868e",
    outline: "#5e6268",
    outlineVariant: "#35373c",
    primary: "#a8c7fa",
    onPrimary: "#062e6f",
    primaryContainer: "#0842a0",
    onPrimaryContainer: "#d3e3fd",
    secondaryContainer: "#004a77",
    onSecondaryContainer: "#c2e7ff",
    highlight: "#f0d23c",
    error: "#f2b8b5",
    success: "#6dd58c",
    warning: "#fdd663",
  },
  light: {
    canvas: "#f8fafd",
    surface: "#ffffff",
    surfaceContainer: "#f0f4f9",
    surfaceContainerHigh: "#e9eef6",
    surfaceContainerHighest: "#dde3ea",
    textPrimary: "#1f1f1f",
    textSecondary: "#444746",
    textMuted: "#747775",
    outline: "#747775",
    outlineVariant: "#c4c7c5",
    primary: "#0b57d0",
    onPrimary: "#ffffff",
    primaryContainer: "#d3e3fd",
    onPrimaryContainer: "#041e49",
    secondaryContainer: "#c2e7ff",
    onSecondaryContainer: "#001d35",
    highlight: "#8f4e06",
    error: "#b3261e",
    success: "#146c2e",
    warning: "#8f4e06",
  },
} as const;

// Paleta de datos: tonos de marca Google (legibles sobre basemap oscuro,
// claro y satelital gracias al trazo de contraste de cada marcador).
const palette = {
  blue: "#4285f4",
  blueLight: "#8ab4f8",
  blueDark: "#1a73e8",
  red: "#ea4335",
  yellow: "#fbbc04",
  yellowLight: "#fde293",
  green: "#34a853",
  orange: "#fa7b17",
  purple: "#a142f4",
  brown: "#b5651d",
  grey: "#9aa0a6",
  greyLight: "#e8eaed",
  white: "#ffffff",
  ink: "#121317",
  teal: "#24c1e0",
} as const;

// Color identitario de cada capa (swatch del panel, icono de la lista de
// eventos, acento del popup).
export const layers = {
  earthquakes: palette.red,
  fires: palette.orange,
  disasters: palette.yellow,
  cyclones: palette.teal,
  volcanoes: palette.brown,
  volcanoCatalog: palette.brown,
  airQuality: palette.green,
  radar: palette.blue,
  iss: palette.blueLight,
  // Swatch del toggle (la sombra nocturna usa marker.night).
  dayNight: palette.grey,
} as const;

export type LayerKey = keyof typeof layers;

// Escalas semánticas por valor.
export const scales = {
  // Magnitud sísmica: interpolada en 2D, por tramos en 3D.
  magnitude: [
    { stop: 2, color: palette.yellow },
    { stop: 4.5, color: palette.orange },
    { stop: 6, color: palette.red },
    { stop: 7.5, color: palette.purple },
  ],
  // Categorías AQI (misma escala para aire observado y modelado).
  aqi: {
    good: palette.green,
    moderate: palette.yellow,
    unhealthy: palette.orange,
    hazardous: palette.purple,
    unknown: palette.grey,
  },
  // Fase del ciclón tal como la publica GDACS por segmento de trayectoria:
  // depresión y tormenta en fríos, huracán/tifón en rojo. (GDACS no da la
  // categoría Saffir-Simpson por tramo; el detalle la deduce del viento máximo.)
  storm: [
    { key: "TD", color: palette.blueLight },
    { key: "TS", color: palette.teal },
    { key: "HU", color: palette.red },
  ],
  // Radar de lluvia: copia de la paleta "Universal Blue" (esquema 2) con la
  // que RainViewer pinta sus teselas; la leyenda debe coincidir con el mapa.
  radar: ["#88ddee", "#0099cc", "#0077aa", "#005588", "#ffee00", "#ff4400", "#ff0000", "#ffaaff"],
  // Nivel de alerta GDACS.
  alert: {
    Red: palette.red,
    Orange: palette.orange,
    Green: palette.green,
  },
} as const;

// Trazos/halos de marcadores y detalles de capa.
export const marker = {
  stroke: palette.white,
  strokeDark: palette.ink,
  fireStroke: palette.yellowLight,
  volcanoStroke: palette.yellowLight,
  issFill: palette.greyLight,
  issStroke: palette.blueLight,
  weatherText: palette.blueLight,
  labelText: palette.greyLight,
  halo: palette.ink,
  selected: palette.blueLight,
  // Variantes para basemap claro (texto oscuro sobre halo blanco).
  weatherTextOnLight: palette.blueDark,
  labelTextOnLight: palette.ink,
  haloOnLight: palette.white,
  // Sombra nocturna (línea día/noche) y cono de incertidumbre de ciclones.
  night: palette.ink,
  cone: palette.white,
  // Volcán con nueva actividad eruptiva esta semana vs. actividad que continúa.
  volcanoNew: palette.red,
  volcanoContinuing: palette.brown,
} as const;

/** Hex (#rrggbb) → rgba() con opacidad, para expresiones de MapLibre/CSS. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function stormColor(category: string): string {
  return scales.storm.find((s) => s.key === normalizeStormCategory(category))?.color ?? scales.storm[1].color;
}

/** Etiqueta de GDACS (TD, TS, HU, TY, H3, Cat. 4…) → TD | TS | HU. */
export function normalizeStormCategory(label: string | undefined): "TD" | "TS" | "HU" {
  const l = (label ?? "").trim().toUpperCase();
  if (l === "TD") return "TD";
  if (/^(HU|TY|STY|H\d|CAT)/.test(l)) return "HU";
  return "TS";
}

export function magnitudeColor(mag: number): string {
  let color: string = scales.magnitude[0].color;
  for (const { stop, color: c } of scales.magnitude) {
    if (mag >= stop) color = c;
  }
  return color;
}

export function alertColor(level: string): string {
  return (scales.alert as Record<string, string>)[level] ?? scales.alert.Green;
}

export function aqiColor(category: string): string {
  return (scales.aqi as Record<string, string>)[category] ?? scales.aqi.unknown;
}

export const colors = { themes, layers, scales, marker, palette } as const;
