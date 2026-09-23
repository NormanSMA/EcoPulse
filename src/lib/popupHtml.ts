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
import { layers, magnitudeColor, alertColor, aqiColor, stormColor } from "@/design-system/tokens";
import { footprintRadiusKm } from "@/lib/geoShapes";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

// Plantillas HTML de los popups, compartidas por el mapa 2D (MapLibre
// setHTML) y el globo 3D (Cesium, popup DOM propio). Un solo lugar = mismos
// campos, mismo orden y mismos colores en ambas vistas. Los estilos viven en
// globals.css (.ep-popup__*); el acento de capa llega vía --ep-accent.
//
// Los popups se generan como HTML fuera del árbol de React (sin acceso a
// next-intl), así que el idioma se fija a nivel de módulo con
// setPopupLocale(), que page.tsx llama cada vez que cambia el locale.

type PopupLocale = "es" | "en";
const MESSAGES = { es, en } as const;
let currentLocale: PopupLocale = "es";

export function setPopupLocale(locale: PopupLocale) {
  currentLocale = locale;
}

type PopupKey = keyof typeof es.popup;

function t(key: PopupKey, values: Record<string, string | number> = {}): string {
  const template = MESSAGES[currentLocale].popup[key] ?? es.popup[key];
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

function aqiLabel(category: string): string {
  const levels = MESSAGES[currentLocale].legend.aqiLevels as Record<string, string>;
  return levels[category] ?? category;
}

function alertLabel(level: string): string {
  const levels = MESSAGES[currentLocale].legend.alertLevels as Record<string, string>;
  return levels[level] ?? level;
}

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

const fmt = (value: string | number) => new Date(value).toLocaleString(currentLocale);

export function earthquakePopup(p: Pick<EarthquakeProperties, "mag" | "place" | "time" | "updated">, depthKm: number): string {
  return card({
    accent: magnitudeColor(p.mag ?? 0),
    title: t("quake", { mag: p.mag != null ? p.mag.toFixed(1) : t("na") }),
    tag: "USGS",
    subtitle: p.place,
    stats: [
      { label: t("magnitude"), value: p.mag != null ? p.mag.toFixed(1) : t("na") },
      { label: t("depth"), value: `${depthKm ?? 0} km` },
    ],
    meta: [t("occurred", { date: fmt(Number(p.time)) }), t("updated", { date: fmt(Number(p.updated)) })],
  });
}

export function airQualityPopup(p: Pick<AirQualityProperties, "station" | "pm25" | "category" | "updated">): string {
  return card({
    accent: aqiColor(p.category),
    title: t("airQuality"),
    tag: aqiLabel(p.category),
    tagAccent: true,
    subtitle: p.station,
    stats: [{ label: "PM2.5", value: `${p.pm25} µg/m³` }],
    meta: [t("updated", { date: fmt(p.updated) })],
    note: t("source", { source: "OpenAQ" }),
  });
}

export function airQualityModelPopup(
  p: Pick<AirQualityModelProperties, "city" | "pm25" | "updated">,
  category: string
): string {
  return card({
    accent: aqiColor(category),
    title: t("airModel"),
    tag: aqiLabel(category),
    tagAccent: true,
    subtitle: p.city,
    stats: [{ label: "PM2.5", value: `${p.pm25} µg/m³` }],
    meta: [t("updated", { date: fmt(p.updated) })],
    note: t("airModelNote"),
  });
}

export function firePopup(p: Pick<FireProperties, "frp" | "confidence" | "satellite" | "acquiredAt">): string {
  return card({
    accent: layers.fires,
    title: t("fire"),
    tag: p.satellite,
    stats: [
      { label: t("frp"), value: `${p.frp} MW` },
      { label: t("confidence"), value: String(p.confidence) },
    ],
    meta: [t("updated", { date: fmt(p.acquiredAt) })],
    note: t("source", { source: "NASA FIRMS" }),
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
      { label: t("temperature"), value: `${p.temperature}°C` },
      { label: t("humidity"), value: `${p.humidity}%` },
      { label: t("wind"), value: `${p.windSpeed} km/h` },
    ],
    meta: [t("updated", { date: fmt(p.updated) })],
    note: t("source", { source: "Open-Meteo" }),
  });
}

export function disasterPopup(
  p: Pick<DisasterProperties, "name" | "eventTypeLabel" | "country" | "alertLevel" | "fromDate" | "toDate" | "reportUrl">
): string {
  const fromStr = p.fromDate ? fmt(p.fromDate) : t("na");
  const toStr = p.toDate ? fmt(p.toDate) : t("ongoing");
  return card({
    accent: alertColor(p.alertLevel),
    title: p.eventTypeLabel,
    tag: t("alert", { level: alertLabel(p.alertLevel) }),
    tagAccent: true,
    subtitle: p.name,
    meta: [p.country, t("range", { from: fromStr, to: toStr })],
    link: { href: safeUrl(p.reportUrl), label: t("gdacsReport") },
  });
}

export function issPopup(p: Pick<IssProperties, "altitudeKm" | "velocityKmS" | "timestamp">): string {
  return card({
    accent: layers.iss,
    title: t("iss"),
    stats: [
      { label: t("altitude"), value: `${p.altitudeKm.toFixed(1)} km` },
      { label: t("velocity"), value: `${p.velocityKmS.toFixed(2)} km/s` },
    ],
    meta: [
      t("updated", { date: fmt(p.timestamp) }),
      `${t("footprint")} ~${Math.round(footprintRadiusKm(p.altitudeKm)).toLocaleString(currentLocale)} km`,
      t("nextPass"),
    ],
    note: t("source", { source: t("issSource") }),
  });
}

export function volcanoPopup(
  p: Pick<VolcanoProperties, "name" | "country" | "volcanoType" | "lastEruptionYear" | "elevationM">
): string {
  const eruptionText =
    p.lastEruptionYear === null
      ? t("noDate")
      : p.lastEruptionYear < 0
        ? t("bc", { year: Math.abs(p.lastEruptionYear) })
        : t("ad", { year: p.lastEruptionYear });
  return card({
    accent: layers.volcanoes,
    title: p.name,
    tag: p.volcanoType,
    subtitle: p.country,
    stats: [
      { label: t("lastEruption"), value: eruptionText },
      { label: t("elevation"), value: `${p.elevationM ?? t("na")} m` },
    ],
    note: t("gvpNote"),
  });
}

export function stormLabel(category: string | undefined): string {
  const c = (category ?? "TS").toUpperCase();
  if (c === "TD") return t("stormTD");
  const h = /^(?:H|CAT)(\d)$/.exec(c);
  return h ? t("stormH", { n: h[1] }) : t("stormTS");
}

export function cyclonePopup(p: { name: string; category?: string; alertLevel: string }): string {
  return card({
    accent: stormColor(p.category ?? "TS"),
    title: t("cyclone", { name: p.name }),
    tag: stormLabel(p.category),
    tagAccent: true,
    meta: [t("alert", { level: alertLabel(p.alertLevel) })],
    note: t("cycloneNote"),
  });
}

export function popupCloseLabel(): string {
  return t("close");
}
