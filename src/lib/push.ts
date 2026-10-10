import type { EarthquakeFeature, CycloneFeature, ActiveVolcanoFeature, DisasterFeature } from "./types";
import { entityIdFor } from "./selection";

// Alertas Web Push: validación de suscripciones, selección de eventos
// candidatos y filtro por preferencias. Sin red ni base de datos.

export type PushLocale = "es" | "en";
export type PushKind = "quake" | "cyclone" | "volcano" | "disaster";

export interface PushPrefs {
  minMagnitude: number;
  cyclones: boolean;
  volcanoes: boolean;
  disasters: boolean;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs: PushPrefs;
  locale: PushLocale;
}

export interface PushText {
  title: string;
  body: string;
}

export interface PushEvent {
  key: string;
  kind: PushKind;
  title: Record<PushLocale, string>;
  body: Record<PushLocale, string>;
  url: string;
  magnitude?: number;
}

export interface PushSources {
  quakes: EarthquakeFeature[];
  cyclones: CycloneFeature[];
  volcanoes: ActiveVolcanoFeature[];
  disasters: DisasterFeature[];
  appUrl: string;
}

const QUAKE_WINDOW_MS = 2 * 3_600_000;
const DISASTER_WINDOW_MS = 48 * 3_600_000;
const MIN_MAG_LIMIT = 4.5;
const MAX_MAG_LIMIT = 9;
const DEFAULT_MIN_MAG = 6;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizePrefs(raw: unknown): PushPrefs {
  const p = isRecord(raw) ? raw : {};
  const mag = typeof p.minMagnitude === "number" && Number.isFinite(p.minMagnitude) ? p.minMagnitude : DEFAULT_MIN_MAG;
  return {
    minMagnitude: Math.min(MAX_MAG_LIMIT, Math.max(MIN_MAG_LIMIT, mag)),
    cyclones: typeof p.cyclones === "boolean" ? p.cyclones : true,
    volcanoes: typeof p.volcanoes === "boolean" ? p.volcanoes : true,
    disasters: typeof p.disasters === "boolean" ? p.disasters : true,
  };
}

/** Devuelve la suscripción normalizada o null si el cuerpo es inválido. */
// Servicios de Web Push de los navegadores (Chrome/Edge/Android, Firefox, Safari, Windows).
const PUSH_HOSTS = [/^fcm.googleapis.com$/, /^updates.push.services.mozilla.com$/, /^web.push.apple.com$/, /.notify.windows.com$/, /.push.apple.com$/];

export function isPushServiceHost(hostname: string): boolean {
  return PUSH_HOSTS.some((re) => re.test(hostname));
}

export function validateSubscription(body: unknown): PushSubscriptionInput | null {
  if (!isRecord(body)) return null;
  const sub = isRecord(body.subscription) ? body.subscription : body;
  const endpoint = sub.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  try {
    const url = new URL(endpoint);
    // Solo servicios de push conocidos: el servidor hace POST a este endpoint (evita SSRF).
    if (url.protocol !== "https:" || !isPushServiceHost(url.hostname)) return null;
  } catch {
    return null;
  }
  const keys = isRecord(sub.keys) ? sub.keys : null;
  if (!keys) return null;
  const { p256dh, auth } = keys;
  if (typeof p256dh !== "string" || !p256dh || typeof auth !== "string" || !auth) return null;
  if (body.locale !== undefined && body.locale !== "es" && body.locale !== "en") return null;
  const locale: PushLocale = body.locale === "en" ? "en" : "es";
  return { endpoint, p256dh, auth, prefs: normalizePrefs(body.prefs), locale };
}

/** "hace 5 min" / "5 min ago". */
export function formatAgo(ms: number, locale: PushLocale): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const text = min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
  return locale === "es" ? `hace ${text}` : `${text} ago`;
}

function link(appUrl: string, entityId: string | null): string {
  const base = appUrl.replace(/\/$/, "");
  return entityId ? `${base}/?sel=${encodeURIComponent(entityId)}` : base;
}

export function collectCandidateEvents(src: PushSources, now: number): PushEvent[] {
  const out: PushEvent[] = [];

  for (const q of src.quakes) {
    const p = q.properties;
    if (p.mag == null || !Number.isFinite(p.time)) continue;
    const age = now - p.time;
    if (age < -60_000 || age > QUAKE_WINDOW_MS) continue;
    const mag = p.mag.toFixed(1);
    const depth = Math.round(q.geometry.coordinates[2]);
    const id = String(q.id);
    out.push({
      key: `quake-${id}`,
      kind: "quake",
      title: { es: `Sismo M ${mag} · ${p.place}`, en: `Earthquake M ${mag} · ${p.place}` },
      body: {
        es: `Profundidad ${depth} km · ${formatAgo(age, "es")}`,
        en: `Depth ${depth} km · ${formatAgo(age, "en")}`,
      },
      url: link(src.appUrl, entityIdFor({ kind: "quake", id })),
      magnitude: p.mag,
    });
  }

  const seenCyclones = new Set<string>();
  for (const c of src.cyclones) {
    const p = c.properties;
    if (p.kind !== "position" || seenCyclones.has(p.eventId)) continue;
    seenCyclones.add(p.eventId);
    const cat = p.category ? ` · ${p.category}` : "";
    out.push({
      key: `cyclone-${p.eventId}`,
      kind: "cyclone",
      title: { es: `Ciclón ${p.name}`, en: `Cyclone ${p.name}` },
      body: { es: `Alerta ${p.alertLevel}${cat}`, en: `Alert ${p.alertLevel}${cat}` },
      url: link(src.appUrl, entityIdFor({ kind: "cyclone", id: p.eventId })),
    });
  }

  for (const v of src.volcanoes) {
    const p = v.properties;
    if (p.status !== "new") continue;
    out.push({
      key: `volcano-${v.id}-${p.period}`,
      kind: "volcano",
      title: { es: `Erupción nueva: ${p.name}`, en: `New eruption: ${p.name}` },
      body: { es: `${p.country} · ${p.period}`, en: `${p.country} · ${p.period}` },
      url: link(src.appUrl, entityIdFor({ kind: "volcano", id: v.id })),
    });
  }

  for (const d of src.disasters) {
    const p = d.properties;
    // Ciclones y volcanes ya salen de sus fuentes propias.
    if (p.eventType === "TC" || p.eventType === "VO") continue;
    if (p.alertLevel === "Green") continue;
    const from = p.fromDate ? Date.parse(p.fromDate) : NaN;
    if (!Number.isFinite(from) || now - from > DISASTER_WINDOW_MS) continue;
    out.push({
      key: `disaster-${p.eventId}`,
      kind: "disaster",
      title: { es: `${p.eventTypeLabel}: ${p.name}`, en: `${p.eventTypeLabel}: ${p.name}` },
      body: { es: `${p.country} · Alerta ${p.alertLevel}`, en: `${p.country} · ${p.alertLevel} alert` },
      url: link(src.appUrl, entityIdFor({ kind: "disaster", id: p.eventId })),
    });
  }

  return out;
}

export function matchesPrefs(event: PushEvent, prefs: PushPrefs): boolean {
  switch (event.kind) {
    case "quake":
      return (event.magnitude ?? 0) >= prefs.minMagnitude;
    case "cyclone":
      return prefs.cyclones;
    case "volcano":
      return prefs.volcanoes;
    case "disaster":
      return prefs.disasters;
  }
}

export function textFor(event: PushEvent, locale: PushLocale): PushText {
  return { title: event.title[locale], body: event.body[locale] };
}
