import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export interface LayerToggleProps {
  label: string;
  icon?: IconNode;
  dotColorClassName?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function LayerToggle({
  label,
  icon,
  dotColorClassName,
  checked,
  onChange,
  loading,
  disabled,
  className,
}: LayerToggleProps) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 p-2.5 rounded-ds-control cursor-pointer",
        "transition-[box-shadow,background-color] duration-ds-fast ease-ds-standard",
        "[background:var(--ds-glass-highlight)] hover:[background:var(--ds-glass-bg-elevated)]",
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <MorphIcon icon={icon} size={16} reducedMotion="user" className="text-ds-text-muted shrink-0" />}
        {dotColorClassName && (
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotColorClassName)} />
        )}
        <span className="text-ds-text-primary text-xs truncate">{label}</span>
      </div>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-ds-full transition-[box-shadow] duration-ds-base",
          checked
            ? "shadow-[var(--ds-shadow-neu-pressed)] bg-gradient-to-r from-brand-400 to-brand-600"
            : "shadow-[var(--ds-shadow-neu-flat)] [background:var(--ds-neu-base)]"
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-ds-base ease-ds-standard",
            checked ? "translate-x-[18px]" : "translate-x-1"
          )}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || loading}
        className="sr-only"
      />
    </label>
  );
}
