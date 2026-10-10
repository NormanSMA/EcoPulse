// EcoPulse para Scriptable (iPhone): widget cuadrado (pequeño).
// Instalación: copia este archivo en un script nuevo de Scriptable llamado
// "EcoPulse", añade un widget pequeño de Scriptable y elige este script.
// Parámetro del widget (opcional): "cerca" muestra el sismo más cercano a tu
// ubicación (pide permiso de ubicación la primera vez).

const APP = "https://ecopulse-eta-two.vercel.app";
const C = {
  bg: new Color("#0f1013"),
  track: new Color("#ffffff", 0.12),
  text: new Color("#ffffff"),
  muted: new Color("#ffffff", 0.6),
  brand: new Color("#a8c7fa"),
};

async function load() {
  let url = `${APP}/api/widget`;
  if ((args.widgetParameter || "").toLowerCase().includes("cerca")) {
    try {
      Location.setAccuracyToThreeKilometers();
      const loc = await Location.current();
      url += `?lat=${loc.latitude.toFixed(2)}&lon=${loc.longitude.toFixed(2)}`;
    } catch (e) {
      // Sin permiso de ubicación: resumen global.
    }
  }
  const req = new Request(url);
  req.timeoutInterval = 15;
  return req.loadJSON();
}

// "12 km WSW of Pitaloza Arriba, Panama" -> "Pitaloza Arriba, Panama"
function cleanPlace(place) {
  return place.replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, "");
}

function ago(ms) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

// Anillo de magnitud (escala 0-9) dibujado como en los widgets del sistema.
function ring(mag, color) {
  const size = 120;
  const lw = 13;
  const r = (size - lw) / 2;
  const cx = size / 2;
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const arc = (from, to, col) => {
    const steps = Math.max(2, Math.round((to - from) * 90));
    for (let i = 0; i < steps; i++) {
      const a = -Math.PI / 2 + (from + (to - from) * (i / steps)) * 2 * Math.PI;
      const p = new Path();
      p.addEllipse(new Rect(cx + r * Math.cos(a) - lw / 2, cx + r * Math.sin(a) - lw / 2, lw, lw));
      ctx.addPath(p);
      ctx.setFillColor(col);
      ctx.fillPath();
    }
  };
  arc(0, 1, C.track);
  arc(0, Math.min(1, Math.max(0.04, mag / 9)), color);

  ctx.setFont(Font.boldRoundedSystemFont(36));
  ctx.setTextColor(C.text);
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(mag.toFixed(1), new Rect(0, size / 2 - 23, size, 46));
  return ctx.getImage();
}

function addText(stack, value, font, color, lines = 1) {
  const t = stack.addText(value);
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.75;
  return t;
}

async function build() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

  let data;
  try {
    data = await load();
  } catch (e) {
    addText(w, "EcoPulse", Font.semiboldSystemFont(13), C.brand);
    w.addSpacer();
    addText(w, "Sin conexión", Font.semiboldSystemFont(17), C.text);
    addText(w, "Se reintentará pronto", Font.systemFont(12), C.muted);
    return w;
  }

  const q = data.quakes.nearest || data.quakes.strongest;
  if (!q) {
    addText(w, "EcoPulse", Font.semiboldSystemFont(13), C.brand);
    w.addSpacer();
    addText(w, "Sin sismos", Font.semiboldSystemFont(20), C.text);
    addText(w, "en las últimas 24 h", Font.systemFont(12), C.muted);
    w.url = data.url;
    return w;
  }
  w.url = q.url;

  const img = w.addImage(ring(q.mag, new Color(q.color)));
  img.imageSize = new Size(62, 62);
  w.addSpacer();

  const label = data.quakes.nearest ? `Más cercano · ${q.distanceKm} km` : "Sismo más fuerte";
  addText(w, label, Font.mediumSystemFont(12), C.muted);
  addText(w, cleanPlace(q.place), Font.semiboldSystemFont(16), C.text, 2);
  w.addSpacer(2);
  addText(w, `${ago(q.time)} · ${q.depthKm} km prof.`, Font.systemFont(11), C.muted);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentSmall();
Script.complete();
