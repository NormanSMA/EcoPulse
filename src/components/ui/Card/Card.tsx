import type { HTMLAttributes } from "react";
import { cn } from "@/design-system/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

/**
 * Tarjeta con borde, sombra y padding consistentes, usando los tokens con
 * tema de Fase 3.1 (ds-surface/ds-border/ds-text vía CSS vars en
 * design-system/theme/theme.css) en vez de clases slate-900 hardcodeadas.
 */
export function Card({ elevated, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-ds-2xl border border-ds-border backdrop-blur-md shadow-[var(--ds-shadow-sm)] p-4",
        elevated ? "bg-ds-surface-elevated" : "bg-ds-surface",
        "text-ds-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
