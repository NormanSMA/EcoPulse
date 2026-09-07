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
        "rounded-ds-2xl border p-4 text-ds-text-primary",
        "[border-color:var(--ds-glass-border)] [backdrop-filter:blur(var(--ds-glass-blur))_saturate(var(--ds-glass-saturate))]",
        elevated
          ? "[background:var(--ds-glass-bg-elevated)] shadow-[var(--ds-shadow-glass-md)]"
          : "[background:var(--ds-glass-bg)] shadow-[var(--ds-shadow-glass-sm)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
