import { useEffect, useRef, useState } from "react";
import { Play, Pause, CalendarDays } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export type TimeWindow = "live" | "1h" | "6h" | "24h" | "7d" | "custom";

// Orden cronológico: el pasado a la izquierda y "En vivo" (ahora) a la derecha.
const WINDOWS: Exclude<TimeWindow, "custom">[] = ["7d", "24h", "6h", "1h", "live"];

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
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-7 max-w-[10.5rem] items-center gap-1.5 rounded-ds-full border px-2.5 text-xs font-medium text-ds-text-primary hover:bg-ds-hover",
          active ? "border-ds-primary bg-ds-primary/10" : "border-ds-outline"
        )}
      >
        <MorphIcon icon={CalendarDays} size={14} reducedMotion="user" className="shrink-0" />
        <span className="truncate">{active ? `${label} ${formatDay(customStart, locale)}` : label}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute bottom-full right-0 z-20 mb-2 min-w-40 rounded-ds-sheet border border-ds-outline-variant bg-ds-panel p-1 shadow-ds-3 backdrop-blur-ds-panel"
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
              }}
              className={cn(
                "block w-full rounded-ds-full px-3 py-1.5 text-left text-xs capitalize text-ds-text-primary hover:bg-ds-hover focus-visible:bg-ds-hover focus-visible:outline-none",
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

/**
 * Tarjeta de línea de tiempo inferior, al estilo del control de fecha de
 * Weather Lab: botón circular de reproducción, fecha actual en UTC y una
 * pista con paradas para la ventana temporal. La ventana filtra sismos,
 * incendios y desastres; la reproducción recorre esa ventana en el tiempo
 * (lógica en page.tsx).
 */
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
  const now = useNow();
  const shown = playhead != null ? new Date(playhead) : now;
  const clock = shown ? formatLocal(shown, locale) : "";
  const utc = shown ? formatUtc(shown, locale) : "";
  const activeIndex = (WINDOWS as TimeWindow[]).indexOf(activeWindow);
  const progress = activeIndex < 0 ? 100 : (activeIndex / (WINDOWS.length - 1)) * 100;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-ds-sheet border border-ds-outline-variant bg-ds-panel px-3 py-3 shadow-ds-3 backdrop-blur-ds-panel sm:gap-4 sm:px-4",
        className
      )}
    >
      <button
        type="button"
        onClick={onTogglePlayback}
        aria-label={playbackLabel}
        aria-pressed={playing}
        className="relative isolate grid h-12 w-12 shrink-0 place-items-center rounded-ds-full border border-ds-outline text-ds-text-primary transition-colors duration-ds-fast before:absolute before:inset-0 before:rounded-full before:bg-current before:opacity-0 hover:before:opacity-[0.08] active:before:opacity-[0.12]"
      >
        <MorphIcon key={playing ? "pause" : "play"} icon={playing ? Pause : Play} size={20} reducedMotion="user" className={cn(!playing && "translate-x-px")} />
      </button>

      {onCycleSpeed && (
        <button
          type="button"
          onClick={onCycleSpeed}
          aria-label={`${speedLabel}: ${speed}x`}
          className="grid h-10 min-w-10 shrink-0 place-items-center rounded-ds-full border border-ds-outline px-2 text-xs font-medium tabular-nums text-ds-text-primary hover:bg-ds-hover"
        >
          {speed}x
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium tabular-nums text-ds-text-primary sm:text-base">
            {clock || " "}
            {utc && <span className="ml-2 text-xs font-normal text-ds-text-muted">{utc}</span>}
          </span>
          {note && playhead == null && (
            <span className="hidden shrink-0 text-xs text-ds-text-muted sm:inline">{note}</span>
          )}
          {activeWindow === "live" && playhead == null && (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ds-status-live">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ds-status-live" />
              {liveLabel}
            </span>
          )}
        </div>

        {(summary || onCustomStart) && (
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-ds-text-muted">{summary}</p>
            {onCustomStart && (
              <FromMenu
                customStart={activeWindow === "custom" ? customStart : null}
                onPick={onCustomStart}
                label={fromLabel}
                todayLabel={todayLabel}
                yesterdayLabel={yesterdayLabel}
                locale={locale}
              />
            )}
          </div>
        )}

        {onSeek && (
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(Math.min(1, Math.max(0, playProgress ?? 1)) * 1000)}
            onChange={(e) => onSeek(Number(e.target.value) / 1000)}
            aria-label={seekLabel}
            className="h-5 w-full cursor-pointer accent-[var(--ds-highlight,currentColor)]"
          />
        )}

        <div role="radiogroup" aria-label={windowLabel} className="relative">
          {/* Pista + progreso */}
          <div className="absolute left-3 right-3 sm:left-4 sm:right-4 top-[9px] h-1 rounded-full bg-ds-surface-highest" aria-hidden="true">
            <div
              className="h-full rounded-full bg-ds-primary transition-[margin,width] duration-ds-slow ease-ds-standard"
              style={{ marginLeft: `${progress}%`, width: `${100 - progress}%` }}
            />
          </div>
          <div className="relative flex justify-between">
            {WINDOWS.map((w, i) => {
              const active = w === activeWindow;
              // Puntos dentro de la ventana visible: del elegido hasta ahora.
              const passed = activeIndex >= 0 && i >= activeIndex;
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onWindowChange(w)}
                  className="group flex w-6 flex-col items-center gap-1 sm:w-8"
                >
                  <span className="grid h-[22px] w-[22px] place-items-center">
                    <span
                      className={cn(
                        "rounded-full transition-all duration-ds-base ease-ds-standard",
                        active
                          ? "h-[18px] w-[18px] bg-ds-primary ring-4 ring-ds-primary/20"
                          : passed
                            ? "h-2 w-2 bg-ds-primary group-hover:h-3 group-hover:w-3"
                            : "h-2 w-2 bg-ds-outline group-hover:h-3 group-hover:w-3"
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[11px] font-medium transition-colors sm:text-xs",
                      active ? "text-ds-text-primary" : "text-ds-text-muted group-hover:text-ds-text-secondary"
                    )}
                  >
                    {w === "live" ? liveLabel : w}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
