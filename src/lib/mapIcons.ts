import { Waves, Sun, Mountain, Flame, Satellite } from "lucide";
import type { IconNode } from "lucide";
import type { Map as MapLibreMap } from "maplibre-gl";
import { layers, marker, scales, themes, alertColor, stormColor } from "@/design-system/tokens";
import type { DisasterEventType } from "@/lib/types";

// Iconos de marcadores dibujados en canvas (sin assets externos). El mismo
// canvas sirve como imagen de MapLibre (addImage) y como billboard de
// Cesium, así 2D y 3D usan exactamente el mismo set.

const PIXEL_RATIO = 2;

export type Glyph = "cyclone" | "flood" | "drought" | "volcano" | "fire" | "satellite";

const LUCIDE: Partial<Record<Glyph, IconNode>> = {
  flood: Waves,
  drought: Sun,
  volcano: Mountain,
  fire: Flame,
  satellite: Satellite,
};

export const DISASTER_GLYPH: Record<DisasterEventType, Glyph> = {
  TC: "cyclone",
  FL: "flood",
  DR: "drought",
  VO: "volcano",
};

/** Dibuja un icono Lucide (viewBox 24) centrado en (cx, cy) con tamaño `size`. */
function drawLucide(ctx: CanvasRenderingContext2D, node: IconNode, cx: number, cy: number, size: number) {
  ctx.save();
  const s = size / 24;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [tag, attrs] of node) {
    const a = attrs as Record<string, string>;
    if (tag === "path") ctx.stroke(new Path2D(a.d));
    else if (tag === "circle") {
      ctx.beginPath();
      ctx.arc(Number(a.cx), Number(a.cy), Number(a.r), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Símbolo meteorológico de ciclón: ojo central con dos brazos en espiral. */
function drawCyclone(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  for (const dir of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.32, 0);
    ctx.bezierCurveTo(dir * r * 0.4, -dir * r * 0.9, -dir * r * 0.2, -dir * r * 1.0, -dir * r * 0.55, -dir * r * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

interface MarkerOptions {
  glyph: Glyph;
  /** Color de relleno del círculo (o del glifo si badge=false). */
  fill: string;
  size: number;
  badge?: boolean;
  ring?: string;
  glyphColor?: string;
}

export function markerCanvas({ glyph, fill, size, badge = true, ring = marker.stroke, glyphColor = marker.stroke }: MarkerOptions): HTMLCanvasElement {
  const pad = 4;
  const px = (size + pad * 2) * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  const c = size / 2 + pad;

  if (badge) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.strokeStyle = glyphColor;
    ctx.lineWidth = 2.2;
    if (glyph === "cyclone") drawCyclone(ctx, c, c, size * 0.62);
    else drawLucide(ctx, LUCIDE[glyph]!, c, c, size * 0.58);
    return canvas;
  }

  // Sin círculo: glifo relleno con contorno de contraste (volcán, incendio).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 2;
  const s = size / 24;
  ctx.translate(pad, pad);
  ctx.scale(s, s);
  const node = LUCIDE[glyph]!;
  ctx.fillStyle = fill;
  ctx.strokeStyle = ring;
  ctx.lineWidth = 1.6 / s;
  ctx.lineJoin = "round";
  for (const [tag, attrs] of node) {
    if (tag !== "path") continue;
    const p = new Path2D((attrs as Record<string, string>).d);
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.restore();
  return canvas;
}

// ---------- Catálogo de iconos de la app ----------

const ALERTS = ["Green", "Orange", "Red"] as const;

export function iconCatalog(): Record<string, HTMLCanvasElement> {
  const icons: Record<string, HTMLCanvasElement> = {};
  (Object.keys(DISASTER_GLYPH) as DisasterEventType[]).forEach((type) => {
    ALERTS.forEach((alert) => {
      icons[`ep-disaster-${type}-${alert}`] = markerCanvas({ glyph: DISASTER_GLYPH[type], fill: alertColor(alert), size: 30 });
    });
  });
  scales.storm.forEach(({ key }) => {
    icons[`ep-cyclone-${key}`] = markerCanvas({ glyph: "cyclone", fill: stormColor(key), size: 32 });
  });
  icons["ep-volcano-new"] = markerCanvas({ glyph: "volcano", fill: marker.volcanoNew, size: 28 });
  icons["ep-volcano-continuing"] = markerCanvas({ glyph: "volcano", fill: marker.volcanoContinuing, size: 26 });
  icons["ep-volcano"] = markerCanvas({ glyph: "volcano", fill: layers.volcanoes, size: 16, badge: false, ring: marker.volcanoStroke });
  icons["ep-fire"] = markerCanvas({ glyph: "fire", fill: layers.fires, size: 18, badge: false, ring: marker.fireStroke });
  icons["ep-iss"] = markerCanvas({ glyph: "satellite", fill: themes.dark.surface, size: 36, ring: marker.issStroke, glyphColor: marker.issStroke });
  return icons;
}

let cachedCatalog: Record<string, HTMLCanvasElement> | null = null;
export function getIcon(id: string): HTMLCanvasElement | undefined {
  cachedCatalog ??= iconCatalog();
  return cachedCatalog[id];
}

/** Registra todos los iconos en MapLibre (hay que repetirlo tras cada setStyle). */
export function registerMapIcons(map: MapLibreMap) {
  cachedCatalog ??= iconCatalog();
  for (const [id, canvas] of Object.entries(cachedCatalog)) {
    if (map.hasImage(id)) continue;
    const ctx = canvas.getContext("2d")!;
    map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: PIXEL_RATIO });
  }
}
