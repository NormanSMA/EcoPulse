// EcoPulse para Scriptable (iPhone): widget pequeño o mediano.
// Instalación: copia este archivo en un script nuevo de Scriptable y añade un
// widget de Scriptable en la pantalla de inicio eligiendo este script.
// Parámetro del widget (opcional): "cerca" para mostrar el sismo más cercano
// a tu ubicación (pide permiso de ubicación la primera vez).

const APP = "https://ecopulse-eta-two.vercel.app";
const COLORS = { bg: new Color("#121317"), card: new Color("#1f2024"), text: new Color("#f8f9fc"), muted: new Color("#b2bbc5"), primary: new Color("#a8c7fa") };

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

function ago(ms) {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function text(stack, value, size, color, weight = "regular") {
  const t = stack.addText(value);
  t.font = weight === "bold" ? Font.boldSystemFont(size) : weight === "medium" ? Font.mediumSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function quakeBlock(stack, q, label) {
  const row = stack.addStack();
  row.centerAlignContent();
  const badge = row.addStack();
  badge.size = new Size(38, 38);
  badge.cornerRadius = 19;
  badge.backgroundColor = new Color(q.color, 0.25);
  badge.centerAlignContent();
  badge.addSpacer();
  text(badge, q.mag.toFixed(1), 14, new Color(q.color), "bold");
  badge.addSpacer();
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  text(col, label, 10, COLORS.muted, "medium");
  text(col, q.place, 13, COLORS.text, "medium");
  const extra = q.distanceKm != null ? ` · a ${q.distanceKm} km` : "";
  text(col, `${q.depthKm} km prof. · ${ago(q.time)}${extra}`, 10, COLORS.muted);
}

async function build() {
  const data = await load();
  const w = new ListWidget();
  w.backgroundColor = COLORS.bg;
  w.setPadding(12, 12, 12, 12);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

  const head = w.addStack();
  head.centerAlignContent();
  text(head, "EcoPulse", 12, COLORS.primary, "bold");
  head.addSpacer();
  text(head, `${data.quakes.count24h} sismos 24 h`, 10, COLORS.muted);
  w.addSpacer(8);

  const main = data.quakes.nearest || data.quakes.strongest;
  if (main) {
    quakeBlock(w, main, data.quakes.nearest ? "MÁS CERCANO" : "MÁS FUERTE 24 H");
    w.url = main.url;
  } else {
    text(w, "Sin sismos en 24 h", 13, COLORS.muted);
    w.url = data.url;
  }

  if (config.widgetFamily !== "small") {
    w.addSpacer(8);
    const row = w.addStack();
    const items = [
      ...data.cyclones.map((c) => ({ label: `${c.name} (${c.category})`, color: c.color })),
      ...data.eruptions.map((v) => ({ label: `Erupción: ${v.name}`, color: v.color })),
      ...data.alerts.map((a) => ({ label: `${a.name}`, color: a.color })),
    ].slice(0, 2);
    if (!items.length) text(row, `${data.quakes.countM5} sismos M ≥ 5 · sin alertas activas`, 11, COLORS.muted);
    const col = row.addStack();
    col.layoutVertically();
    for (const it of items) {
      const line = col.addStack();
      line.centerAlignContent();
      const dot = line.addStack();
      dot.size = new Size(8, 8);
      dot.cornerRadius = 4;
      dot.backgroundColor = new Color(it.color);
      line.addSpacer(6);
      text(line, it.label, 11, COLORS.text);
    }
  }
  w.addSpacer();
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
