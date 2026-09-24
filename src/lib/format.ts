// Formatos compartidos por el panel de detalle y la bandeja de eventos.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "hace 12 min", "in 3 hours"… (relativo a `now`). */
export function relativeTime(ms: number, locale: string, now: number = Date.now()): string {
  const diff = ms - now;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size || unit === "minute") return rtf.format(Math.round(diff / size), unit);
  }
  return rtf.format(0, "minute");
}

export function formatDateTime(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Clasificación sismológica por profundidad del foco: superficiales (<70 km,
 * los más destructivos), intermedios (70–300 km) y profundos (>300 km).
 */
export type DepthClass = "shallow" | "intermediate" | "deep";
export function depthClass(km: number): DepthClass {
  if (km < 70) return "shallow";
  if (km <= 300) return "intermediate";
  return "deep";
}

/** Rumbo en grados → punto cardinal (8 rumbos). */
export function compass(deg: number, locale: string): string {
  const es = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const en = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return (locale === "es" ? es : en)[i];
}

export function formatCoords(lon: number, lat: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

/** Distancia en km (haversine). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * Periodo del reporte semanal de volcanes ("10 September-16 September 2026",
 * a veces cruzando meses o años) en el idioma de la interfaz. Si el texto no
 * sigue el formato conocido se devuelve tal cual.
 */
export function formatReportPeriod(period: string, locale: string): string {
  const m = /^(\d{1,2}) ([A-Za-z]+)(?: (\d{4}))?-(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(period.trim());
  if (!m) return period;
  const [, d1, m1, y1, d2, m2, y2] = m;
  const i1 = MONTHS.indexOf(m1.toLowerCase());
  const i2 = MONTHS.indexOf(m2.toLowerCase());
  if (i1 < 0 || i2 < 0) return period;
  const start = Date.UTC(Number(y1 ?? y2), i1, Number(d1));
  const end = Date.UTC(Number(y2), i2, Number(d2));
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return fmt.formatRange(start, end);
}

/** Categoría Saffir-Simpson (1–5) para un viento sostenido en km/h; null si no es huracán. */
export function saffirSimpson(kmh: number): number | null {
  if (kmh >= 252) return 5;
  if (kmh >= 209) return 4;
  if (kmh >= 178) return 3;
  if (kmh >= 154) return 2;
  if (kmh >= 119) return 1;
  return null;
}
