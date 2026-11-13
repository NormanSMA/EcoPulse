import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, CalendarDays } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";
import { Button, IconButton } from "@/components/ui/Button";
import { cn } from "@/design-system/utils/cn";

import { isForecastWindow, stopGroup, type StopGroup, type TimeWindow } from "@/lib/timeline";

export type { TimeWindow };

// Orden cronológico: pasado a la izquierda, "En vivo" (ahora) y pronóstico a la derecha.
const WINDOWS: Exclude<TimeWindow, "custom">[] = ["7d", "24h", "6h", "1h", "live", "+24h", "+48h", "+72h"];
const LIVE_INDEX = WINDOWS.indexOf("live");

export interface TimeControlProps {
  window: TimeWindow;
  onWindowChange: (window: TimeWindow) => void;
  playing: boolean;
  onTogglePlayback: () => void;
  liveLabel?: string;
  playbackLabel?: string;
  windowLabel?: string;
  locale?: string;
  /** Instante del cursor durante la reproducción (ms). Sustituye al reloj. */
  playhead?: number | null;
  /** Progreso de la reproducción 0..1 (barra fina bajo la fecha). */
  playProgress?: number | null;
  /** Resumen del periodo ("Últimas 24 h · 38 sismos · M máx 6,1"). */
  summary?: string;
  /** Mueve el cursor de reproducción (0..1 dentro de la ventana). */
  onSeek?: (fraction: number) => void;
  speed?: number;
  onCycleSpeed?: () => void;
  speedLabel?: string;
  seekLabel?: string;
  /** Aviso corto (p.ej. "Sismos: últimos 7 días"). */
  note?: string;
  /** Inicio (ms) del día elegido cuando la ventana es "custom". */
  customStart?: number | null;
  /** Elige el inicio de un día local (ms). */
  onCustomStart?: (startMs: number) => void;
  fromLabel?: string;
  todayLabel?: string;
  yesterdayLabel?: string;
  className?: string;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDay(ms: number, locale?: string) {
  return new Date(ms).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** Menu "Desde": hoy y los 7 dias anteriores en hora local. */
function FromMenu({
  customStart,
  onPick,
  label,
  todayLabel,
  yesterdayLabel,
  locale,
}: {
  customStart?: number | null;
  onPick: (startMs: number) => void;
  label: string;
  todayLabel: string;
  yesterdayLabel: string;
  locale?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const days = open
    ? Array.from({ length: 8 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ms = startOfDay(d);
        return { ms, text: i === 0 ? todayLabel : i === 1 ? yesterdayLabel : formatDay(ms, locale) };
      })
    : [];

  // Cierra al tocar fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Foco al primer elemento al abrir.
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("button")?.focus();
      return;
    }
    if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const active = customStart != null;
  return (
    <div ref={ref} className="relative shrink-0" onKeyDown={onKeyDown}>
      <Button
        variant="outlined"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "max-w-24 gap-1 px-2 text-xs sm:max-w-44",
          active ? "border-ds-primary bg-ds-primary/10" : "border-ds-outline"
        )}
      >
        <MorphIcon icon={CalendarDays} size={14} reducedMotion="user" className="shrink-0" />
        <span className="truncate">{active ? `${label} ${formatDay(customStart, locale)}` : label}</span>
      </Button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="ds-glass absolute bottom-full right-0 z-20 mb-2 min-w-40 rounded-ds-card p-1"
        >
          {days.map((d) => (
            <button
              key={d.ms}
              type="button"
              role="menuitemradio"
              aria-checked={customStart === d.ms}
              onClick={() => {
                onPick(d.ms);
                setOpen(false);
                ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
              }}
              className={cn(
                "block min-h-11 w-full rounded-full px-3 py-1.5 text-left text-xs capitalize text-ds-text-primary hover:bg-ds-hover active:bg-ds-press focus-visible:bg-ds-hover focus-visible:ring-2 focus-visible:ring-ds-primary",
                customStart === d.ms && "font-semibold text-ds-primary"
              )}
            >
              {d.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hora local del navegador (Intl) y hora UTC aparte.
function formatLocal(date: Date, locale?: string) {
  return date.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatUtc(date: Date, locale?: string) {
  return `${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC`;
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Despliega las paradas móviles sin aumentar la altura de la cápsula.
export function TimeControl({
  window: activeWindow,
  onWindowChange,
  playing,
  onTogglePlayback,
  liveLabel = "Live",
  playbackLabel = "Playback",
  windowLabel = "Time window",
  locale,
  playhead,
  playProgress,
  note,
  summary,
  onSeek,
  speed = 1,
  onCycleSpeed,
  speedLabel = "Playback speed",
  seekLabel = "Playback position",
  customStart,
  onCustomStart,
  fromLabel = "From",
  todayLabel = "Today",
  yesterdayLabel = "Yesterday",
  className,
}: TimeControlProps) {
  const t = useTranslations("time");
  const rootRef = useRef<HTMLDivElement>(null);
  const stopsId = useId();
  const [expandedGroup, setExpandedGroup] = useState<Exclude<StopGroup, "live"> | null>(null);
  const now = useNow();
  useEffect(() => {
    if (!expandedGroup) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpandedGroup(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedGroup(null);
        rootRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [expandedGroup]);
  const shown = playhead != null ? new Date(playhead) : now;
  const clock = shown ? formatLocal(shown, locale) : "";
  const utc = shown ? formatUtc(shown, locale) : "";
  const activeIndex = (WINDOWS as TimeWindow[]).indexOf(activeWindow);
  // Tramo resaltado: entre la parada elegida y "ahora" (hacia atrás o hacia adelante).
  const forecast = isForecastWindow(activeWindow);
  const from = activeIndex < 0 ? LIVE_INDEX : Math.min(activeIndex, LIVE_INDEX);
  const to = activeIndex < 0 ? LIVE_INDEX : Math.max(activeIndex, LIVE_INDEX);
  const trackStart = (from / (WINDOWS.length - 1)) * 100;
  const trackWidth = ((to - from) / (WINDOWS.length - 1)) * 100;

  const activeGroup = stopGroup(activeWindow);
  const shownGroup = expandedGroup ?? activeGroup;
  const railColor = forecast
    ? "bg-ds-warning shadow-[0_0_14px_rgb(var(--ds-warning)/0.45)]"
    : "bg-gradient-to-r from-[#0070ff] to-[#38bdf8] shadow-ds-glow";
  const onRadioKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"], [role="tab"]'));
    const index = radios.findIndex((radio) => radio === event.target);
    const next = radios[(index + (event.key === "ArrowRight" ? 1 : -1) + radios.length) % radios.length];
    next?.focus();
    next?.click();
  };

  return (
    <div ref={rootRef} className={cn("ds-glass relative flex min-w-0 flex-col rounded-ds-panel px-2 py-1 sm:px-3", className)}>
      <div className="flex h-10 min-w-0 items-center gap-2">
        <IconButton aria-label={playbackLabel} aria-pressed={playing} onClick={onTogglePlayback} variant="outlined">
          <MorphIcon icon={playing ? Pause : Play} size={20} reducedMotion="user" />
        </IconButton>
        {onCycleSpeed && (
          <Button variant="text" size="sm" onClick={onCycleSpeed} aria-label={`${speedLabel}: ${speed}x`} className="min-w-8 px-1 tabular-nums">
            {speed}x
          </Button>
        )}
        <div className="min-w-0 flex-1 tabular-nums" title={[summary, note].filter(Boolean).join(" · ")}>
          <p className="truncate text-xs font-medium text-ds-text-primary sm:text-sm">{clock || " "}</p>
          <p className="truncate text-[11px] text-ds-text-muted">{[utc, summary].filter(Boolean).join(" · ") || " "}</p>
          {note && <p className="sr-only">{note}</p>}
        </div>
        {onCustomStart && <FromMenu customStart={activeWindow === "custom" ? customStart : null} onPick={onCustomStart} label={fromLabel} todayLabel={todayLabel} yesterdayLabel={yesterdayLabel} locale={locale} />}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {onSeek && (
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(Math.min(1, Math.max(0, playProgress ?? (forecast ? 0 : 1))) * 1000)}
            onChange={(event) => onSeek(Number(event.target.value) / 1000)}
            aria-label={seekLabel}
            className={cn("hidden h-11 w-24 shrink-0 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ds-primary sm:block", forecast ? "accent-ds-warning" : "accent-ds-primary")}
          />
        )}
        <div role="radiogroup" aria-label={windowLabel} onKeyDown={onRadioKeyDown} className="relative hidden h-11 min-w-0 flex-1 sm:block">
          <div className="absolute inset-x-5 top-3 h-1 rounded-full bg-ds-surface-highest" aria-hidden="true">
            <div className={cn("h-full rounded-full", railColor)} style={{ marginLeft: `${trackStart}%`, width: `${trackWidth}%` }} />
          </div>
          <div className="relative flex justify-between">
            {WINDOWS.map((window, index) => {
              const active = window === activeWindow;
              const passed = activeIndex >= 0 && index >= from && index <= to;
              return (
                <button key={window} type="button" role="radio" aria-checked={active} tabIndex={active || (activeIndex < 0 && window === "live") ? 0 : -1} onClick={() => onWindowChange(window)} className="group flex h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-full hover:bg-ds-hover active:bg-ds-press focus-visible:ring-2 focus-visible:ring-ds-primary disabled:pointer-events-none disabled:opacity-40">
                  <span aria-hidden="true" className="grid h-5 w-5 place-items-center">
                    <span className={cn("rounded-full", active ? cn("h-4 w-4 ring-2 ring-white/20", railColor) : passed ? cn("h-2 w-2", railColor) : "h-2 w-2 bg-ds-outline")} />
                  </span>
                  <span className={cn("whitespace-nowrap text-[11px]", active ? "text-ds-text-primary" : "text-ds-text-muted")}>{window === "live" ? liveLabel : window}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div role="tablist" aria-label={windowLabel} onKeyDown={onRadioKeyDown} className="flex h-11 min-w-0 flex-1 items-center gap-1 sm:hidden">
          {(["past", "live", "forecast"] as const).map((group) => (
            <Button
              key={group}
              variant="text"
              size="sm"
              role="tab"
              aria-selected={shownGroup === group}
              aria-expanded={group === "live" ? undefined : expandedGroup === group}
              aria-controls={expandedGroup === group ? stopsId : undefined}
              tabIndex={shownGroup === group ? 0 : -1}
              className={cn("min-w-0 flex-1 px-2 text-[11px]", shownGroup === group ? group === "forecast" ? "bg-ds-warning/15 text-ds-warning" : group === "live" ? "bg-ds-status-live/15 text-ds-status-live" : "bg-ds-primary/15 text-ds-primary" : "text-ds-text-secondary")}
              onClick={() => {
                if (group === "live") {
                  setExpandedGroup(null);
                  onWindowChange("live");
                } else {
                  setExpandedGroup(expandedGroup === group ? null : group);
                }
              }}
            >
              {t(group === "past" ? "groupPast" : group === "live" ? "groupLive" : "groupForecast")}
            </Button>
          ))}
        </div>
      </div>
      {expandedGroup && (
        <div id={stopsId} role="radiogroup" aria-label={windowLabel} onKeyDown={onRadioKeyDown} className="ds-glass absolute inset-x-0 bottom-full mb-2 flex gap-2 overflow-x-auto rounded-ds-card p-2 sm:hidden">
          {WINDOWS.filter((window) => stopGroup(window) === expandedGroup).map((window, index) => (
            <Button key={window} variant="outlined" role="radio" aria-checked={activeWindow === window} tabIndex={activeWindow === window || ((activeWindow === "custom" || activeGroup !== expandedGroup) && index === 0) ? 0 : -1} onClick={() => onWindowChange(window)} className={cn("min-h-11 flex-1", activeWindow === window && (expandedGroup === "forecast" ? "border-ds-warning text-ds-warning" : "border-ds-primary text-ds-primary"))}>
              {window}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
