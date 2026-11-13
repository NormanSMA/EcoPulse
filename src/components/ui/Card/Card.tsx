import type { HTMLAttributes } from "react";
import { cn } from "@/design-system/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "floating" | "glass" | "filled" | "outlined";
}

export function Card({ variant = "floating", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "text-ds-text-primary",
        variant === "floating" &&
          "ds-glass rounded-ds-panel",
        variant === "glass" && "ds-glass rounded-ds-panel shadow-[var(--ds-glass-inset)]",
        variant === "filled" && "rounded-ds-card border border-ds-divider bg-white/[0.04]",
        variant === "outlined" && "rounded-ds-card border border-ds-divider",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
