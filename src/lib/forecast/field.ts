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
