import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { WeatherFrame } from "../../lib/forecast/types";
import { buildFrameFields, fieldToPoints } from "../../lib/forecast/field";
import { colors, withAlpha } from "../../design-system/tokens/colors";

export const WEATHER_SOURCE = "weather-grid";
const CLOUDS_SOURCE = "weather-clouds-field";
const RAIN_SOURCE = "weather-rain-field";
const EMPTY_FIELD: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
export const WEATHER_LAYER_IDS = {
  wind: ["weather-wind"],
  clouds: ["weather-clouds"],
  rain: ["weather-rain", "weather-rain-label"],
  grid: ["weather-grid-points"],
} as const;

const { palette } = colors;
const WIND_ARROW = "ep-weather-wind-arrow";

function fieldRadius(cellDeg: number): ExpressionSpecification {
  const radius = (cellDeg * 512 / 360) * 1.6;
  return ["interpolate", ["exponential", 2], ["zoom"], 0, radius, 22, radius * 2 ** 22];
}

export function weatherFrameToGeoJSON(frame: WeatherFrame | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: (frame?.features ?? []).map(({ lon, lat, ...weather }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        ...weather,
        precipitationProbability: weather.precipitationProbability ?? 0,
        arrowRotation: (weather.windDirection + 180) % 360,
      },
    })),
  };
}

function registerWindArrow(map: MapLibreMap): void {
  if (typeof document === "undefined" || map.hasImage(WIND_ARROW)) return;
  const size = 64;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return;
  const image = context.createImageData(size, size);
  const outline: [number, number][] = [
    [32, 8], [52, 30], [38, 30], [38, 56], [26, 56], [26, 30], [12, 30],
  ];

  // Calcula distancia firmada al contorno; MapLibre sitúa el borde SDF en 0.75.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      let distance = Infinity;
      for (let i = 0; i < outline.length; i++) {
        const [ax, ay] = outline[i];
        const [bx, by] = outline[(i + 1) % outline.length];
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
        distance = Math.min(distance, Math.hypot(px - ax - t * dx, py - ay - t * dy));
        if ((ay > py) !== (by > py) && px < ax + ((py - ay) * dx) / dy) inside = !inside;
      }
      const offset = (y * size + x) * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = Math.round(255 * Math.max(0, Math.min(1, 0.75 + (inside ? distance : -distance) / 8)));
    }
  }
  map.addImage(WIND_ARROW, image, { sdf: true, pixelRatio: 2 });
}

export function addWeatherLayers(
  map: MapLibreMap,
  frame: WeatherFrame | null,
  visible: { wind: boolean; clouds: boolean; rain: boolean },
  beforeId?: string,
): void {
  if (map.getSource(WEATHER_SOURCE)) return;
  registerWindArrow(map);
  const fields = buildFrameFields(frame);
  const radius = fieldRadius(fields?.cellDeg ?? 0.25);
  map.addSource(WEATHER_SOURCE, { type: "geojson", data: weatherFrameToGeoJSON(frame) });
  map.addSource(CLOUDS_SOURCE, { type: "geojson", data: fields ? fieldToPoints(fields.clouds, 5) : EMPTY_FIELD });
  map.addSource(RAIN_SOURCE, { type: "geojson", data: fields ? fieldToPoints(fields.rain, 0.05) : EMPTY_FIELD });

  map.addLayer({
    id: WEATHER_LAYER_IDS.clouds[0],
    type: "heatmap",
    source: CLOUDS_SOURCE,
    layout: { visibility: visible.clouds ? "visible" : "none" },
    paint: {
      "heatmap-radius": radius,
      "heatmap-weight": ["/", ["get", "value"], 100],
      "heatmap-intensity": 0.7,
      "heatmap-opacity": 0.55,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, withAlpha(palette.grey, 0),
        0.2, withAlpha(palette.grey, 0.25),
        0.6, withAlpha(palette.greyLight, 0.65),
        1, withAlpha(palette.white, 0.85),
      ],
    },
  }, beforeId);

  map.addLayer({
    id: WEATHER_LAYER_IDS.rain[0],
    type: "heatmap",
    source: RAIN_SOURCE,
    layout: { visibility: visible.rain ? "visible" : "none" },
    paint: {
      "heatmap-radius": radius,
      "heatmap-weight": ["min", 1, ["/", ["get", "value"], 10]],
      "heatmap-intensity": 0.9,
      "heatmap-opacity": 0.75,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, withAlpha(palette.blueLight, 0),
        0.2, palette.blueLight,
        0.5, palette.blue,
        0.75, palette.blueDark,
        1, palette.violet,
      ],
    },
  }, beforeId);

  map.addLayer({
    id: WEATHER_LAYER_IDS.grid[0],
    type: "circle",
    source: WEATHER_SOURCE,
    layout: { visibility: visible.wind || visible.clouds || visible.rain ? "visible" : "none" },
    paint: {
      "circle-radius": 2.5,
      "circle-color": palette.greyLight,
      "circle-stroke-color": palette.ink,
      "circle-stroke-width": 1,
    },
  }, beforeId);

  map.addLayer({
    id: WEATHER_LAYER_IDS.wind[0],
    type: "symbol",
    source: WEATHER_SOURCE,
    layout: {
      visibility: visible.wind ? "visible" : "none",
      "icon-image": WIND_ARROW,
      "icon-rotate": ["get", "arrowRotation"],
      "icon-rotation-alignment": "map",
      "icon-size": ["interpolate", ["linear"], ["get", "windSpeed"], 0, 0.45, 60, 1.1],
      "icon-allow-overlap": true,
    },
    paint: {
      "icon-color": ["interpolate", ["linear"], ["get", "windSpeed"], 0, palette.blueLight, 30, palette.cyan, 60, palette.violet],
      "icon-halo-color": palette.ink,
      "icon-halo-width": 1,
    },
  }, beforeId);

  map.addLayer({
    id: WEATHER_LAYER_IDS.rain[1],
    type: "symbol",
    source: WEATHER_SOURCE,
    minzoom: 7,
    filter: [">=", ["get", "precipitation"], 0.5],
    layout: {
      visibility: visible.rain ? "visible" : "none",
      "text-field": ["concat", ["number-format", ["get", "precipitation"], { "min-fraction-digits": 1, "max-fraction-digits": 1 }], " mm"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-offset": [0, 1.5],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": palette.greyLight,
      "text-halo-color": palette.ink,
      "text-halo-width": 1.5,
    },
  }, beforeId);
}

export function setWeatherFrame(map: MapLibreMap, frame: WeatherFrame | null): void {
  const source = map.getSource(WEATHER_SOURCE) as GeoJSONSource | undefined;
  source?.setData(weatherFrameToGeoJSON(frame));
  const fields = buildFrameFields(frame);
  const clouds = map.getSource(CLOUDS_SOURCE) as GeoJSONSource | undefined;
  const rain = map.getSource(RAIN_SOURCE) as GeoJSONSource | undefined;
  clouds?.setData(fields ? fieldToPoints(fields.clouds, 5) : EMPTY_FIELD);
  rain?.setData(fields ? fieldToPoints(fields.rain, 0.05) : EMPTY_FIELD);
  for (const id of [WEATHER_LAYER_IDS.clouds[0], WEATHER_LAYER_IDS.rain[0]]) {
    if (map.getLayer(id)) map.setPaintProperty(id, "heatmap-radius", fieldRadius(fields?.cellDeg ?? 0.25));
  }
}
