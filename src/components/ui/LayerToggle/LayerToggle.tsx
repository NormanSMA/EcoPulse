import { Check, Minus } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

/** Switch Material 3 (track 52×32, handle que crece al activarse). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
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
        "group relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-ds-full border-2 transition-colors duration-ds-base ease-ds-standard",
        "disabled:opacity-40 disabled:pointer-events-none",
        on ? "bg-ds-primary border-ds-primary" : "bg-ds-surface-highest border-ds-outline",
        className
      )}
    >
      <span
        className={cn(
          "absolute rounded-ds-full transition-all duration-ds-base ease-ds-out",
          "before:absolute before:-inset-2 before:rounded-full before:bg-current before:opacity-0 group-hover:before:opacity-[0.08]",
          on
            ? "left-[22px] h-6 w-6 bg-ds-primary-on text-ds-primary"
            : "left-[6px] h-4 w-4 bg-ds-outline text-ds-text-primary"
        )}
      />
    </button>
  );
}

/** Checkbox Material 3 (18px, esquina 2px, check sobre primary). */
export function Checkbox({ checked, mixed }: { checked: boolean; mixed?: boolean }) {
  const on = checked || !!mixed;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border-2 transition-colors duration-ds-fast",
        on ? "bg-ds-primary border-ds-primary text-ds-primary-on" : "border-ds-text-secondary"
      )}
    >
      {on && <MorphIcon icon={mixed ? Minus : Check} size={14} strokeWidth={3} reducedMotion="user" />}
    </span>
  );
}

export interface LayerToggleProps {
  label: string;
  /** Color identitario de la capa (tokens/colors.ts → layers). */
  swatch?: string;
  /** Swatch como anillo (capas "contorno", p.ej. aire modelado). */
  swatchRing?: boolean;
  /** Etiqueta de fuente (USGS, OpenAQ…), estilo "Operational" de Weather Lab. */
  tag?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Fila de capa: swatch cuadrado + nombre + tag de fuente + checkbox, igual
 * que la lista de modelos del panel "Controls" de Weather Lab. Toda la fila
 * es el área táctil (≥ 44px de alto).
 */
export function LayerToggle({ label, swatch, swatchRing, tag, checked, onChange, disabled, className }: LayerToggleProps) {
  return (
    <label
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-ds-control px-3 py-2",
        "transition-colors duration-ds-fast hover:bg-ds-hover has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ds-primary",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 rounded-[4px]", swatchRing && "border-[3px] bg-transparent")}
          style={swatchRing ? { borderColor: swatch } : { backgroundColor: swatch }}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-ds-text-primary">{label}</span>
      {tag && (
        <span className="inline-flex h-6 shrink-0 items-center rounded-ds-full border border-ds-outline-variant px-2 text-[11px] font-medium text-ds-text-secondary">
          {tag}
        </span>
      )}
      <Checkbox checked={checked} />
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  );
}
