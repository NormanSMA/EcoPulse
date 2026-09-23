import type {
  EarthquakeProperties,
  AirQualityProperties,
  FireProperties,
  WeatherProperties,
  DisasterProperties,
  IssProperties,
  VolcanoProperties,
  AirQualityModelProperties,
} from "@/lib/types";
import { layers, magnitudeColor, alertColor, aqiColor } from "@/design-system/tokens";

// Plantillas HTML de los popups, compartidas por el mapa 2D (MapLibre
// setHTML) y el globo 3D (Cesium, popup DOM propio). Un solo lugar = mismos
// campos, mismo orden y mismos colores en ambas vistas. Los estilos viven en
// globals.css (.ep-popup__*); el acento de capa llega vía --ep-accent.

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? esc(url) : null;
}

interface Stat {
  label: string;
  value: string;
}

interface PopupSpec {
  accent: string;
  title: string;
  tag?: string;
  tagAccent?: boolean;
  subtitle?: string;
  stats?: Stat[];
  meta?: string[];
  note?: string;
  link?: { href: string | null; label: string };
}

function card({ accent, title, tag, tagAccent, subtitle, stats, meta, note, link }: PopupSpec): string {
  return `<div class="ep-popup" style="--ep-accent:${accent}">
    <div class="ep-popup__head">
      <span class="ep-popup__dot"></span>
      <span class="ep-popup__title">${esc(title)}</span>
    </div>
    ${tag ? `<span class="ep-popup__tag${tagAccent ? " ep-popup__tag--accent" : ""}">${esc(tag)}</span>` : ""}
    ${subtitle ? `<div class="ep-popup__subtitle">${esc(subtitle)}</div>` : ""}
    ${
      stats && stats.length
        ? `<div class="ep-popup__stats">${stats
            .map(
              (s) =>
                `<div class="ep-popup__stat"><span class="ep-popup__stat-label">${esc(s.label)}</span><span class="ep-popup__stat-value">${esc(s.value)}</span></div>`
            )
            .join("")}</div>`
        : ""
    }
    ${(meta ?? []).map((m) => `<div class="ep-popup__meta">${esc(m)}</div>`).join("")}
    ${link?.href ? `<a class="ep-popup__link" href="${link.href}" target="_blank" rel="noopener noreferrer">${esc(link.label)} ↗</a>` : ""}
    ${note ? `<div class="ep-popup__note">${esc(note)}</div>` : ""}
  </div>`;
}

const fmt = (value: string | number) => new Date(value).toLocaleString();

export function earthquakePopup(p: Pick<EarthquakeProperties, "mag" | "place" | "time" | "updated">, depthKm: number): string {
  return card({
    accent: magnitudeColor(p.mag ?? 0),
    title: `Sismo M ${p.mag ?? "N/D"}`,
    tag: "USGS",
    subtitle: p.place,
    stats: [
      { label: "Magnitud", value: p.mag != null ? p.mag.toFixed(1) : "N/D" },
      { label: "Profundidad", value: `${depthKm ?? 0} km` },
    ],
    meta: [`Ocurrió: ${fmt(Number(p.time))}`, `Última actualización: ${fmt(Number(p.updated))}`],
  });
}

export function airQualityPopup(p: Pick<AirQualityProperties, "station" | "pm25" | "category" | "updated">): string {
  return card({
    accent: aqiColor(p.category),
    title: "Calidad del aire",
    tag: p.category,
    tagAccent: true,
    subtitle: p.station,
    stats: [{ label: "PM2.5", value: `${p.pm25} µg/m³` }],
    meta: [`Última actualización: ${fmt(p.updated)}`],
    note: "Fuente: OpenAQ",
  });
}

export function airQualityModelPopup(
  p: Pick<AirQualityModelProperties, "city" | "pm25" | "updated">,
  category: string
): string {
  return card({
    accent: aqiColor(category),
    title: "Aire (modelo)",
    tag: category,
    tagAccent: true,
    subtitle: p.city,
    stats: [{ label: "PM2.5", value: `${p.pm25} µg/m³` }],
    meta: [`Última actualización: ${fmt(p.updated)}`],
    note: "Estimado por Open-Meteo, no observado directamente",
  });
}

export function firePopup(p: Pick<FireProperties, "frp" | "confidence" | "satellite" | "acquiredAt">): string {
  return card({
    accent: layers.fires,
    title: "Incendio activo",
    tag: p.satellite,
    stats: [
      { label: "FRP", value: `${p.frp} MW` },
      { label: "Confianza", value: String(p.confidence) },
    ],
    meta: [`Última actualización: ${fmt(p.acquiredAt)}`],
    note: "Fuente: NASA FIRMS",
  });
}

export function weatherPopup(
  p: Pick<WeatherProperties, "city" | "temperature" | "humidity" | "windSpeed" | "weatherDescription" | "updated">
): string {
  return card({
    accent: layers.weather,
    title: p.city,
    tag: p.weatherDescription,
    stats: [
      { label: "Temperatura", value: `${p.temperature}°C` },
      { label: "Humedad", value: `${p.humidity}%` },
      { label: "Viento", value: `${p.windSpeed} km/h` },
    ],
    meta: [`Última actualización: ${fmt(p.updated)}`],
    note: "Fuente: Open-Meteo",
  });
}

export function disasterPopup(
  p: Pick<DisasterProperties, "name" | "eventTypeLabel" | "country" | "alertLevel" | "fromDate" | "toDate" | "reportUrl">
): string {
  const fromStr = p.fromDate ? fmt(p.fromDate) : "N/D";
  const toStr = p.toDate ? fmt(p.toDate) : "en curso";
  return card({
    accent: alertColor(p.alertLevel),
    title: p.eventTypeLabel,
    tag: `Alerta ${p.alertLevel}`,
    tagAccent: true,
    subtitle: p.name,
    meta: [p.country, `Desde: ${fromStr} · Hasta: ${toStr}`],
    link: { href: safeUrl(p.reportUrl), label: "Ver reporte GDACS" },
  });
}

export function issPopup(p: Pick<IssProperties, "altitudeKm" | "velocityKmS" | "timestamp">): string {
  return card({
    accent: layers.iss,
    title: "Estación Espacial Internacional",
    stats: [
      { label: "Altitud", value: `${p.altitudeKm.toFixed(1)} km` },
      { label: "Velocidad", value: `${p.velocityKmS.toFixed(2)} km/s` },
    ],
    meta: [`Última actualización: ${fmt(p.timestamp)}`],
    note: "Fuente: NASA (trayectoria OEM)",
  });
}

export function volcanoPopup(
  p: Pick<VolcanoProperties, "name" | "country" | "volcanoType" | "lastEruptionYear" | "elevationM">
): string {
  const eruptionText =
    p.lastEruptionYear === null
      ? "Sin fecha documentada"
      : p.lastEruptionYear < 0
        ? `${Math.abs(p.lastEruptionYear)} a.C.`
        : `${p.lastEruptionYear} d.C.`;
  return card({
    accent: layers.volcanoes,
    title: p.name,
    tag: p.volcanoType,
    subtitle: p.country,
    stats: [
      { label: "Última erupción", value: eruptionText },
      { label: "Elevación", value: `${p.elevationM ?? "N/D"} m` },
    ],
    note: "Catálogo histórico (GVP) — no es monitoreo en tiempo real",
  });
}
