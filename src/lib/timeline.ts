// Ventana temporal pura: pasado/en vivo (como antes en page.tsx) y pronostico.

export type TimeWindow = "live" | "1h" | "6h" | "24h" | "7d" | "custom" | "+24h" | "+48h" | "+72h";
export type TimelineMode = "live" | "past" | "forecast";

export const HOUR_MS = 3_600_000;
export const FORECAST_WINDOWS = ["+24h", "+48h", "+72h"] as const;

const PAST_MS: Partial<Record<TimeWindow, number>> = { "1h": HOUR_MS, "6h": 6 * HOUR_MS, "24h": 24 * HOUR_MS, "7d": 168 * HOUR_MS };
const FORECAST_HOURS: Partial<Record<TimeWindow, 24 | 48 | 72>> = { "+24h": 24, "+48h": 48, "+72h": 72 };

export function isForecastWindow(w: TimeWindow): boolean {
  return w in FORECAST_HOURS;
}

/** Estado global que muestra el indicador único del Header. */
export type GlobalMode = "live" | "history" | "forecast" | "offline";

/**
 * Sin red manda "offline". Con red: pronóstico si la ventana es futura,
 * historial si hay ventana pasada o reproducción, y en vivo en otro caso.
 */
export function globalMode({ online, window, playing = false }: { online: boolean; window: TimeWindow; playing?: boolean }): GlobalMode {
  if (!online) return "offline";
  if (isForecastWindow(window)) return "forecast";
  if (window !== "live" || playing) return "history";
  return "live";
}

/** Grupo de la timeline compacta en móvil: Pasado | LIVE | Pronóstico. */
export type StopGroup = "past" | "live" | "forecast";

export function stopGroup(w: TimeWindow): StopGroup {
  if (w === "live") return "live";
  return isForecastWindow(w) ? "forecast" : "past";
}

export interface TimelineInput {
  window: TimeWindow;
  customStart: number | null;
  playhead: number | null;
  now: number;
}

export interface Timeline {
  mode: TimelineMode;
  windowMs: number | null;
  span: number;
  spanStart: number;
  refTime: number;
  rangeStart: number;
  rangeEnd: number;
  playProgress: number | null;
  usesWeek: boolean;
  needWeek: boolean;
  horizonHours: 0 | 24 | 48 | 72;
}

export function resolveTimeline({ window, customStart, playhead, now }: TimelineInput): Timeline {
  const horizonHours = FORECAST_HOURS[window] ?? 0;
  if (horizonHours) {
    const span = horizonHours * HOUR_MS;
    return {
      mode: "forecast",
      windowMs: span,
      span,
      spanStart: now,
      refTime: playhead ?? now,
      rangeStart: -Infinity,
      rangeEnd: Infinity,
      playProgress: playhead != null ? (playhead - now) / span : null,
      usesWeek: false,
      needWeek: false,
      horizonHours,
    };
  }
  const windowMs = window === "custom" ? now - (customStart ?? now) : PAST_MS[window] ?? null;
  const span = Math.max(windowMs ?? 24 * HOUR_MS, HOUR_MS / 4);
  return {
    mode: window === "live" ? "live" : "past",
    windowMs,
    span,
    spanStart: now - span,
    refTime: playhead ?? now,
    rangeStart: window === "custom" && customStart != null ? customStart : windowMs != null || playhead != null ? now - span : -Infinity,
    rangeEnd: playhead ?? Infinity,
    playProgress: playhead != null ? (playhead - (now - span)) / span : null,
    usesWeek: window === "7d" || window === "custom",
    needWeek: window === "7d" || (window === "custom" && customStart != null && customStart < now - 24 * HOUR_MS),
    horizonHours: 0,
  };
}

export function playbackStart(tl: Timeline): number {
  return tl.spanStart;
}

export function playbackStep(tl: Timeline, tickMs: number, speed: number, durationMs: number): number {
  return (tl.span * tickMs * speed) / durationMs;
}

export function playbackEnded(playhead: number | null, tl: Timeline, now: number): boolean {
  if (playhead == null) return false;
  return playhead >= (tl.mode === "forecast" ? now + tl.span : now);
}

export function seekTime(fraction: number, tl: Timeline, now: number): number {
  if (tl.mode === "forecast") return now + Math.min(1, Math.max(0, fraction)) * tl.span;
  return Math.min(now - 1, now - tl.span + fraction * tl.span);
}
