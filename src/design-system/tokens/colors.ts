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
} as const;

// Color identitario de cada capa (swatch del panel, icono de la lista de
// eventos, acento del popup).
export const layers = {
  earthquakes: palette.red,
  airQuality: palette.green,
  airQualityModel: palette.green,
  fires: palette.orange,
  weather: palette.blue,
  disasters: palette.yellow,
  iss: palette.blueLight,
  volcanoes: palette.brown,
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
} as const;

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
