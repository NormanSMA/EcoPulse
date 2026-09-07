import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/utils/cn";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-ds-control font-semibold select-none " +
    "transition-[transform,box-shadow,background-color,color] duration-ds-fast ease-ds-standard " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
    "active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_2px_2px_rgba(0,0,0,0.15),0_8px_20px_-6px_rgba(99,102,241,0.55)] hover:brightness-110 active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
        secondary:
          "text-ds-text-primary [background:var(--ds-neu-base)] shadow-[var(--ds-shadow-neu-raised)] hover:brightness-105 active:shadow-[var(--ds-shadow-neu-pressed)]",
        quiet:
          "text-ds-text-secondary hover:text-ds-text-primary hover:[background:var(--ds-glass-highlight)] active:shadow-[var(--ds-shadow-neu-pressed)]",
        danger:
          "bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_2px_2px_rgba(0,0,0,0.15),0_8px_20px_-6px_rgba(244,63,94,0.5)] hover:brightness-110 active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), loading && "cursor-wait", className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
