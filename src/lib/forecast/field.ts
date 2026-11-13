import type { BBox } from "@/lib/geo";
import type { WeatherFrame } from "./types";

export type FieldSpec = { bbox: BBox; width: number; height: number; power?: number };
export type ScalarField = { values: Float32Array; width: number; height: number; bbox: BBox };
export type WindField = { u: Float32Array; v: Float32Array; width: number; height: number; bbox: BBox };

export function idwGrid(
  xs: Float64Array,
  ys: Float64Array,
  values: Float64Array,
  spec: FieldSpec,
): Float32Array {
  const { bbox, width, height } = spec;
  const power = spec.power ?? 2;
  const out = new Float32Array(width * height);
  const n = Math.min(xs.length, ys.length, values.length);
  if (n === 0) return out;
  const [west, south, east, north] = bbox;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  for (let i = 0; i < height; i++) {
    const lat = north - (i / (height - 1)) * (north - south);
    for (let j = 0; j < width; j++) {
      const lon = west + (j / (width - 1)) * (east - west);
      let sw = 0;
      let sv = 0;
      let exact = false;
      for (let p = 0; p < n; p++) {
        const dx = (xs[p] - lon) * k;
        const dy = ys[p] - lat;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-9) {
          out[i * width + j] = values[p];
          exact = true;
          break;
        }
        const w = 1 / Math.pow(d, power);
        sw += w;
        sv += w * values[p];
      }
      if (!exact) out[i * width + j] = sv / sw;
    }
  }
  return out;
}

function columns(frame: WeatherFrame | null, pick: (f: WeatherFrame["features"][number]) => number) {
  const fs = frame?.features ?? [];
  const xs = new Float64Array(fs.length);
  const ys = new Float64Array(fs.length);
  const vs = new Float64Array(fs.length);
  fs.forEach((f, i) => {
    xs[i] = f.lon;
    ys[i] = f.lat;
    vs[i] = pick(f);
  });
  return { xs, ys, vs };
}

export function buildScalarField(
  frame: WeatherFrame | null,
  key: "cloudCover" | "precipitation" | "temperature" | "windSpeed",
  spec: FieldSpec,
): ScalarField {
  const { xs, ys, vs } = columns(frame, (f) => f[key]);
  return { values: idwGrid(xs, ys, vs, spec), width: spec.width, height: spec.height, bbox: spec.bbox };
}

export function buildWindField(frame: WeatherFrame | null, spec: FieldSpec): WindField {
  const { xs, ys, vs: us } = columns(frame, (f) => f.u);
  const { vs } = columns(frame, (f) => f.v);
  return {
    u: idwGrid(xs, ys, us, spec),
    v: idwGrid(xs, ys, vs, spec),
    width: spec.width,
    height: spec.height,
    bbox: spec.bbox,
  };
}

export function buildFrameFields(frame: WeatherFrame | null, resolution = 96) {
  if (!frame?.features.length) return null;
  const longitudes = frame.features.map((point) => point.lon);
  const latitudes = frame.features.map((point) => point.lat);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const size = Math.max(24, Math.min(128, Math.round(resolution)));
  const marginLon = Math.max(0.25, (east - west) / (size - 1) / 2);
  const marginLat = Math.max(0.25, (north - south) / (size - 1) / 2);
  const bbox: BBox = [west - marginLon, south - marginLat, east + marginLon, north + marginLat];
  const spanLon = bbox[2] - bbox[0];
  const spanLat = bbox[3] - bbox[1];
  const ratio = spanLon / spanLat;
  const width = ratio < 0.5 ? Math.max(24, Math.round(size * ratio)) : size;
  const height = ratio > 2 ? Math.max(24, Math.round(size / ratio)) : size;
  const spec: FieldSpec = { bbox, width, height };
  // IDW deja un "ojo de buey" alrededor de cada nodo: se suaviza con un radio
  // proporcional a la separación media entre nodos (en celdas).
  const spacing = Math.sqrt((width * height) / frame.features.length);
  const radius = Math.max(2, Math.round(spacing * 0.6));
  const wind = buildWindField(frame, spec);
  const clouds = buildScalarField(frame, "cloudCover", spec);
  const rain = buildScalarField(frame, "precipitation", spec);
  smoothInPlace(clouds.values, width, height, radius);
  smoothInPlace(rain.values, width, height, radius);
  smoothInPlace(wind.u, width, height, radius);
  smoothInPlace(wind.v, width, height, radius);
  return { bbox, cellDeg: Math.max(spanLon / width, spanLat / height), wind, clouds, rain };
}

/** Suavizado gaussiano aproximado: tres pasadas de desenfoque de caja separable. */
export function smoothInPlace(values: Float32Array, width: number, height: number, radius: number): void {
  if (radius < 1) return;
  const scratch = new Float32Array(values.length);
  const pass = (source: Float32Array, target: Float32Array, horizontal: boolean) => {
    const length = horizontal ? width : height;
    const lines = horizontal ? height : width;
    const stride = horizontal ? 1 : width;
    const lineStride = horizontal ? width : 1;
    for (let line = 0; line < lines; line++) {
      const base = line * lineStride;
      for (let i = 0; i < length; i++) {
        let sum = 0;
        let count = 0;
        const from = Math.max(0, i - radius);
        const to = Math.min(length - 1, i + radius);
        for (let k = from; k <= to; k++) {
          sum += source[base + k * stride];
          count++;
        }
        target[base + i * stride] = sum / count;
      }
    }
  };
  for (let round = 0; round < 3; round++) {
    pass(values, scratch, true);
    pass(scratch, values, false);
  }
}

export function sampleWind(field: WindField, lon: number, lat: number): [number, number] {
  const { width, height, bbox } = field;
  const [west, south, east, north] = bbox;
  if (lon < west || lon > east || lat < south || lat > north) return [0, 0];
  const fx = ((lon - west) / (east - west)) * (width - 1);
  const fy = ((north - lat) / (north - south)) * (height - 1);
  const x0 = Math.min(Math.floor(fx), width - 2);
  const y0 = Math.min(Math.floor(fy), height - 2);
  const tx = fx - x0;
  const ty = fy - y0;
  const lerp = (a: Float32Array) => {
    const top = a[y0 * width + x0] * (1 - tx) + a[y0 * width + x0 + 1] * tx;
    const bot = a[(y0 + 1) * width + x0] * (1 - tx) + a[(y0 + 1) * width + x0 + 1] * tx;
    return top * (1 - ty) + bot * ty;
  };
  return [lerp(field.u), lerp(field.v)];
}

export function fieldToPoints(
  field: ScalarField,
  minValue: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const { width, height, values } = field;
  const [west, south, east, north] = field.bbox;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const value = values[i * width + j];
      if (value < minValue) continue;
      features.push({
        type: "Feature",
        properties: { value },
        geometry: {
          type: "Point",
          coordinates: [
            west + (j / (width - 1)) * (east - west),
            north - (i / (height - 1)) * (north - south),
          ],
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
