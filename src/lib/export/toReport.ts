import { haversineKm } from "../geo";
import type { ExportFile, ZonePack } from "../zones/types";
import { flattenEvents } from "./toCsv";
import { exportBaseName } from "./toJson";

const MAX_POINTS = 20;
const MAX_EVENTS = 50;
const HOURS = 72;

type Locale = "es" | "en";

const TEXT = {
  es: {
    created: "Creado",
    validUntil: "Vigente hasta",
    summary: "Resumen por punto",
    point: "Punto",
    tMin: "Temp. mín (°C)",
    tMax: "Temp. máx (°C)",
    rain: "Lluvia 72 h (mm)",
    gust: "Racha máx (km/h)",
    pm25: "PM2.5 máx",
    charts: "Gráficos del punto",
    temperature: "Temperatura (°C)",
    rainChart: "Lluvia por hora (mm)",
    events: "Eventos",
    kind: "Tipo",
    id: "ID",
    time: "Hora (UTC)",
    magnitude: "Magnitud",
    title: "Título",
    noEvents: "Sin eventos.",
    noData: "Sin datos.",
  },
  en: {
    created: "Created",
    validUntil: "Valid until",
    summary: "Summary by point",
    point: "Point",
    tMin: "Temp. min (°C)",
    tMax: "Temp. max (°C)",
    rain: "Rain 72 h (mm)",
    gust: "Max gust (km/h)",
    pm25: "PM2.5 max",
    charts: "Point charts",
    temperature: "Temperature (°C)",
    rainChart: "Hourly rain (mm)",
    events: "Events",
    kind: "Type",
    id: "ID",
    time: "Time (UTC)",
    magnitude: "Magnitude",
    title: "Title",
    noEvents: "No events.",
    noData: "No data.",
  },
} as const;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function num(value: unknown, digits = 1): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function utc(ms: number): string {
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? "-" : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function finite(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function extreme(values: (number | null | undefined)[], pick: (...n: number[]) => number): string {
  const v = finite(values);
  return v.length ? num(pick(...v)) : "-";
}

function charts(t: string, temps: number[], rain: number[]): string {
  const W = 600;
  const H = 140;
  const pad = 8;
  const n = temps.length;
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (n > 1 ? (i * (W - 2 * pad)) / (n - 1) : 0);
  const line = temps.map((v, i) => `${x(i).toFixed(1)},${(H - pad - ((v - lo) / span) * (H - 2 * pad)).toFixed(1)}`).join(" ");
  const maxRain = Math.max(...rain, 0.1);
  const bw = Math.max((W - 2 * pad) / Math.max(rain.length, 1) - 1, 1);
  const bars = rain
    .map((v, i) => {
      const h = (Math.max(v, 0) / maxRain) * (H - 2 * pad);
      return `<rect x="${x(i).toFixed(1)}" y="${(H - pad - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="bar"/>`;
    })
    .join("");
  return (
    `<h3>${escapeHtml(t)}: ${num(lo)} - ${num(hi)}</h3>` +
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t)}"><polyline points="${line}" class="line"/></svg>` +
    `<h3>${num(maxRain, 1)} mm max</h3>` +
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="rain">${bars}</svg>`
  );
}

const STYLE =
  "body{font-family:sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%;margin:12px 0}" +
  "th,td{border:1px solid #bbb;padding:4px 8px;text-align:left;font-size:13px}th{background:#eee}" +
  "svg{width:100%;max-width:600px;height:auto;border:1px solid #ddd}.line{fill:none;stroke:#c2410c;stroke-width:2}" +
  ".bar{fill:#2563eb}";

export function toReport(pack: ZonePack, locale: Locale): ExportFile {
  const t = TEXT[locale] ?? TEXT.es;
  const { points, weather, air, time } = pack.forecast;
  const hours = Math.min(HOURS, time.length);

  const order = points.map((p, i) => i).sort((a, b) => Number(!!points[b].anchor) - Number(!!points[a].anchor));
  const shown = order.slice(0, MAX_POINTS);
  const summaryRows = shown
    .map((i) => {
      const p = points[i];
      const w = weather[i];
      const rain = finite(w.precipitation.slice(0, hours)).reduce((s, v) => s + v, 0);
      return (
        `<tr><td>${escapeHtml(p.label ?? p.id)}</td><td>${extreme(w.temperature.slice(0, hours), Math.min)}</td>` +
        `<td>${extreme(w.temperature.slice(0, hours), Math.max)}</td><td>${num(rain)}</td>` +
        `<td>${extreme(w.windGusts.slice(0, hours), Math.max)}</td>` +
        `<td>${extreme(air[i]?.pm25.slice(0, hours) ?? [], Math.max)}</td></tr>`
      );
    })
    .join("");

  let chartHtml = `<p>${t.noData}</p>`;
  if (points.length && hours > 0) {
    const center = pack.meta.zone.center;
    const anchor = points.findIndex((p) => p.anchor);
    let pick = anchor;
    if (pick < 0) {
      let best = Infinity;
      points.forEach((p, i) => {
        const d = haversineKm(center, [p.lon, p.lat]);
        if (d < best) {
          best = d;
          pick = i;
        }
      });
    }
    const w = weather[pick];
    const name = escapeHtml(points[pick].label ?? points[pick].id);
    chartHtml = `<p>${name}</p>` + charts(t.temperature, w.temperature.slice(0, hours).map(Number), w.precipitation.slice(0, hours).map(Number));
  }

  const events = flattenEvents(pack);
  const eventRows = events
    .slice(0, MAX_EVENTS)
    .map((e) => {
      const title = e.url.startsWith("https://")
        ? `<a href="${escapeHtml(e.url)}" rel="noopener noreferrer">${escapeHtml(e.title)}</a>`
        : escapeHtml(e.title);
      return (
        `<tr><td>${escapeHtml(e.kind)}</td><td>${escapeHtml(e.id)}</td><td>${escapeHtml(e.time ?? "-")}</td>` +
        `<td>${e.magnitude === null ? "-" : num(e.magnitude)}</td><td>${title}</td></tr>`
      );
    })
    .join("");

  const zone = escapeHtml(pack.meta.zone.name);
  const html =
    `<!DOCTYPE html><html lang="${locale === "en" ? "en" : "es"}"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>EcoPulse - ${zone}</title>` +
    `<style>${STYLE}</style></head><body>` +
    `<h1>EcoPulse - ${zone}</h1>` +
    `<p>${t.created}: ${utc(pack.meta.createdAt)}<br>${t.validUntil}: ${utc(pack.meta.validUntil)}</p>` +
    `<h2>${t.summary}</h2><table><thead><tr><th>${t.point}</th><th>${t.tMin}</th><th>${t.tMax}</th><th>${t.rain}</th><th>${t.gust}</th><th>${t.pm25}</th></tr></thead>` +
    `<tbody>${summaryRows}</tbody></table>` +
    `<h2>${t.charts}</h2>${chartHtml}` +
    `<h2>${t.events} (${events.length})</h2>` +
    (events.length
      ? `<table><thead><tr><th>${t.kind}</th><th>${t.id}</th><th>${t.time}</th><th>${t.magnitude}</th><th>${t.title}</th></tr></thead><tbody>${eventRows}</tbody></table>`
      : `<p>${t.noEvents}</p>`) +
    `</body></html>`;

  return { filename: `${exportBaseName(pack)}.html`, mime: "text/html", content: html };
}
