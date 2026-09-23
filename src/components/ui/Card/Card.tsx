import type { HTMLAttributes } from "react";
import { cn } from "@/design-system/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * - `floating`: panel sobre el mapa (casi opaco + blur leve + elevación),
   *   como el panel "Controls" de Weather Lab.
   * - `filled`: bloque dentro de un panel (surface-container), sin sombra.
   * - `outlined`: borde fino, fondo transparente.
   */
  variant?: "floating" | "filled" | "outlined";
}

export function Card({ variant = "floating", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "text-ds-text-primary",
        variant === "floating" &&
          "rounded-ds-panel bg-ds-panel backdrop-blur-ds-panel border border-ds-outline-variant shadow-ds-2",
        variant === "filled" && "rounded-ds-xl bg-ds-surface-container",
        variant === "outlined" && "rounded-ds-xl border border-ds-outline-variant",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
