import type { CSSProperties } from "react";
import { cn } from "@/design-system/utils/cn";

export function Switch({
  checked,
  mixed,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const on = checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative mr-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border",
        "after:absolute after:left-1/2 after:top-1/2 after:h-full after:w-full after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2",
        "disabled:opacity-40 disabled:pointer-events-none",
        "hover:border-ds-primary/60 hover:shadow-ds-glow active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-canvas",
        on ? "border-ds-primary bg-gradient-to-r from-[#0070ff] to-[#38bdf8] shadow-ds-glow" : "border-ds-control bg-ds-glass",
        className
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 h-4 w-4 overflow-hidden rounded-full transition-transform duration-ds-base ease-ds-out motion-reduce:transition-none",
          mixed && "border border-white before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-white",
          on
            ? cn("translate-x-5", !mixed && "bg-white")
            : "bg-ds-text-muted"
        )}
      />
    </button>
  );
}

export interface LayerToggleProps {
  label: string;
  /** Color identitario de la capa (tokens/colors.ts → layers). */
  swatch?: string;
  /** Conserva compatibilidad con capas de contorno. */
  swatchRing?: boolean;
  /** Fuente de datos (USGS, OpenAQ…). */
  tag?: string;
  /** Aviso de fuente caída, sin ocultar su nombre. */
  alert?: string;
  checked: boolean;
  mixed?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function LayerToggle({ label, swatch, tag, alert, checked, mixed, onChange, disabled, className }: LayerToggleProps) {
  const on = checked || !!mixed;
  return (
    <button
      type="button"
      aria-pressed={mixed ? "mixed" : on}
      disabled={disabled}
      onClick={() => onChange(!!mixed || !checked)}
      className={cn(
        "relative flex min-h-11 w-full min-w-11 items-center gap-2 rounded-full px-2 py-1.5 text-left",
        "hover:bg-ds-hover active:bg-ds-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px]",
          on ? "ds-glow border-[color:var(--ep-accent)]" : "border-[color:color-mix(in_srgb,var(--ep-accent)_45%,transparent)]",
          on && !mixed && "bg-[color:var(--ep-accent)]",
          mixed && "overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-[color:var(--ep-accent)]"
        )}
        style={{ "--ep-accent": swatch ?? "rgb(var(--ds-primary))" } as CSSProperties}
      />
      <span className="min-w-0 flex-1 text-sm leading-5 text-ds-text-primary">{label}</span>
      {(tag || alert) && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-ds-text-muted">
          {tag}
          {alert && (
            <span role="status" title={alert} className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-danger">
              <span className="sr-only">{alert}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
}
