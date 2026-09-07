import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-ds-fast ease-ds-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700",
        secondary: "bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700",
        quiet: "text-slate-200 hover:bg-slate-800",
        danger: "bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700",
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
