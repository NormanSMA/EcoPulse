import { useId, useState, type ReactNode } from "react";
import type { IconNode } from "lucide";
import { ChevronDown } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export interface SectionProps {
  title: string;
  icon?: IconNode;
  /** Control a la derecha del título (p.ej. un Switch maestro). */
  trailing?: ReactNode;
  /** Texto secundario junto al título (p.ej. "3/8"). */
  meta?: string;
  defaultOpen?: boolean;
  /** Nivel visual: `primary` = sección del panel, `nested` = subgrupo. */
  level?: "primary" | "nested";
  children: ReactNode;
  className?: string;
}

/**
 * Sección colapsable estilo Weather Lab ("Weather ⏻ / ˅ Model"): fila de
 * cabecera con chevron + icono + título y un control opcional a la derecha,
 * cuerpo que se pliega con animación de altura (grid-rows 0fr → 1fr).
 */
export function Section({ title, icon, trailing, meta, defaultOpen = true, level = "primary", children, className }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className={cn(level === "primary" && "border-t border-ds-outline-variant first:border-t-0", className)}>
      <div className={cn("flex items-center gap-2", level === "primary" ? "px-2 py-2" : "px-1 py-0.5")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            "relative flex min-h-11 flex-1 items-center gap-3 rounded-ds-control px-2 text-left transition-colors duration-ds-fast hover:bg-ds-hover",
            level === "primary" ? "text-base font-medium text-ds-text-primary" : "text-sm text-ds-text-secondary"
          )}
        >
          <MorphIcon
            icon={ChevronDown}
            size={18}
            reducedMotion="user"
            className={cn("shrink-0 text-ds-text-secondary transition-transform duration-ds-base ease-ds-standard", !open && "-rotate-90")}
          />
          {icon && <MorphIcon icon={icon} size={20} reducedMotion="user" className="shrink-0 text-ds-text-primary" />}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {meta && <span className="shrink-0 text-xs font-normal tabular-nums text-ds-text-muted">{meta}</span>}
        </button>
        {trailing}
      </div>
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-ds-slow ease-ds-standard",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className={cn(level === "primary" ? "px-2 pb-3" : "pb-1")}>{children}</div>
        </div>
      </div>
    </section>
  );
}
