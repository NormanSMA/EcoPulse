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
  className?: string;
}

/**
 * Barra inferior de control temporal. Fase 3.2: solo UI — el estado de
 * ventana/playback vive acá pero todavía no filtra las capas del mapa (eso
 * queda para una fase futura, tal como pidió Norman explícitamente).
 */
export function TimeControl({
  window: activeWindow,
  onWindowChange,
  playing,
  onTogglePlayback,
  liveLabel = "Live",
  playbackLabel = "Playback",
  className,
}: TimeControlProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 border-t px-4 py-2",
        "[border-color:var(--ds-glass-border)] [background:var(--ds-glass-bg-strong)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))]",
        className
      )}
    >
      {WINDOWS.map((w) => (
        <button
          key={w}
          onClick={() => onWindowChange(w)}
          className={cn(
            "px-3 py-1.5 rounded-ds-control text-xs font-semibold transition-[box-shadow,background-color,color] duration-ds-fast active:scale-[0.97]",
            activeWindow === w
              ? "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_2px_2px_rgba(0,0,0,0.15),0_6px_14px_-4px_rgba(99,102,241,0.5)]"
              : "text-ds-text-secondary hover:[background:var(--ds-glass-highlight)]"
          )}
        >
          {w === "live" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-ds-status-live" />
              {liveLabel}
            </span>
          ) : (
            w
          )}
        </button>
      ))}

      <div className="h-4 w-px bg-ds-border mx-1" />

      <button
        onClick={onTogglePlayback}
        aria-label={playbackLabel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-ds-control text-xs font-semibold text-ds-text-secondary hover:[background:var(--ds-glass-highlight)] transition-[background-color] duration-ds-fast active:scale-[0.97]"
      >
        <MorphIcon icon={playing ? Pause : Play} size={14} reducedMotion="user" />
        {playbackLabel}
      </button>
    </div>
  );
}
