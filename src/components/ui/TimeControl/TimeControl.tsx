import { useEffect, useState } from "react";
import { Play, Pause } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export type TimeWindow = "live" | "1h" | "6h" | "24h" | "7d";

const WINDOWS: TimeWindow[] = ["live", "1h", "6h", "24h", "7d"];

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
  /** Aviso corto (p.ej. "Sismos: últimos 7 días"). */
  note?: string;
  className?: string;
}

function formatUtc(date: Date, locale?: string) {
  return `${date.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
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
  className,
}: TimeControlProps) {
  const now = useNow();
  const shown = playhead != null ? new Date(playhead) : now;
  const clock = shown ? formatUtc(shown, locale) : "";
  const activeIndex = WINDOWS.indexOf(activeWindow);
  const progress = (activeIndex / (WINDOWS.length - 1)) * 100;

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

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium tabular-nums text-ds-text-primary sm:text-base">
            {clock || " "}
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

        {playProgress != null && (
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-ds-surface-highest" aria-hidden="true">
            <div className="h-full bg-ds-highlight" style={{ width: `${Math.min(100, playProgress * 100)}%` }} />
          </div>
        )}

        <div role="radiogroup" aria-label={windowLabel} className="relative">
          {/* Pista + progreso */}
          <div className="absolute left-3 right-3 sm:left-4 sm:right-4 top-[9px] h-1 rounded-full bg-ds-surface-highest" aria-hidden="true">
            <div
              className="h-full rounded-full bg-ds-primary transition-[width] duration-ds-slow ease-ds-standard"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="relative flex justify-between">
            {WINDOWS.map((w, i) => {
              const active = w === activeWindow;
              const passed = i <= activeIndex;
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
