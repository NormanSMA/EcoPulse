import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/utils/cn";

const stateLayer =
  "before:absolute before:inset-0 before:rounded-[inherit] before:bg-current before:opacity-0 " +
  "before:transition-opacity before:duration-ds-fast hover:before:opacity-[0.08] active:before:opacity-[0.12]";

const touchTarget =
  "after:absolute after:left-1/2 after:top-1/2 after:h-full after:w-full after:min-h-11 after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2";

const interaction =
  "hover:border-ds-primary/60 hover:shadow-ds-glow focus-visible:border-ds-primary/60 focus-visible:shadow-ds-glow " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ds-canvas " +
  "[&_svg]:transition-transform [&_svg]:duration-ds-fast motion-safe:hover:[&_svg]:scale-105 motion-reduce:[&_svg]:transition-none";

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 rounded-full font-medium select-none whitespace-nowrap " +
    "duration-ds-fast ease-ds-standard " + interaction + " " +
    "disabled:opacity-40 disabled:pointer-events-none " +
    stateLayer + " " + touchTarget,
  {
    variants: {
      variant: {
        filled: "border border-transparent bg-ds-primary-strong text-white",
        tonal: "bg-ds-secondary-container text-ds-secondary-on-container",
        outlined: "border border-ds-control bg-ds-glass text-ds-primary",
        text: "text-ds-primary",
        elevated: "border border-ds-control bg-ds-glass text-ds-text-primary backdrop-blur-ds-glass shadow-ds-2",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "filled",
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
  ({ variant, size, loading, disabled, className, children, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), loading && "cursor-wait", className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

const iconButtonVariants = cva(
  "relative isolate inline-flex shrink-0 items-center justify-center rounded-full select-none " +
    "duration-ds-fast ease-ds-standard " + interaction + " " +
    "disabled:opacity-40 disabled:pointer-events-none " +
    stateLayer + " " + touchTarget,
  {
    variants: {
      variant: {
        standard: "text-ds-text-secondary hover:text-ds-text-primary",
        filled: "border border-transparent bg-ds-primary-strong text-white",
        tonal: "bg-ds-secondary-container text-ds-secondary-on-container",
        outlined: "border border-ds-control bg-ds-glass text-ds-primary",
        elevated: "border border-ds-control bg-ds-glass text-ds-text-primary backdrop-blur-ds-glass shadow-ds-2",
      },
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "standard", selected: true, className: "bg-ds-secondary-container text-ds-secondary-on-container hover:text-ds-secondary-on-container" },
    ],
    defaultVariants: {
      variant: "standard",
      size: "md",
      selected: false,
    },
  }
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant, size, selected, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      title={props["aria-label"]}
      className={cn(iconButtonVariants({ variant, size, selected }), className)}
      {...props}
    >
      {children}
    </button>
  )
);

IconButton.displayName = "IconButton";
