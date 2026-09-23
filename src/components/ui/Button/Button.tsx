import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/design-system/utils/cn";

// Botones Material 3 en pill (DS 4.0). El "state layer" de hover/press se
// pinta con un ::before del color del contenido, como en Weather Lab, para
// que funcione igual sobre cualquier fondo (filled, tonal o transparente).
const stateLayer =
  "before:absolute before:inset-0 before:rounded-[inherit] before:bg-current before:opacity-0 " +
  "before:transition-opacity before:duration-ds-fast hover:before:opacity-[0.08] active:before:opacity-[0.12]";

const buttonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 rounded-ds-full font-medium select-none whitespace-nowrap " +
    "transition-[background-color,color,box-shadow] duration-ds-fast ease-ds-standard " +
    "disabled:opacity-40 disabled:pointer-events-none " +
    stateLayer,
  {
    variants: {
      variant: {
        filled: "bg-ds-primary text-ds-primary-on hover:shadow-ds-1",
        tonal: "bg-ds-secondary-container text-ds-secondary-on-container",
        outlined: "border border-ds-outline text-ds-primary",
        text: "text-ds-primary",
        elevated: "bg-ds-panel-strong backdrop-blur-ds-panel text-ds-text-primary shadow-ds-2 border border-ds-outline-variant",
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
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

const iconButtonVariants = cva(
  "relative isolate inline-flex shrink-0 items-center justify-center rounded-ds-full select-none " +
    "transition-[background-color,color] duration-ds-fast ease-ds-standard " +
    "disabled:opacity-40 disabled:pointer-events-none " +
    stateLayer,
  {
    variants: {
      variant: {
        standard: "text-ds-text-secondary hover:text-ds-text-primary",
        filled: "bg-ds-primary text-ds-primary-on",
        tonal: "bg-ds-secondary-container text-ds-secondary-on-container",
        elevated: "bg-ds-panel-strong backdrop-blur-ds-panel text-ds-text-primary shadow-ds-2 border border-ds-outline-variant",
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
