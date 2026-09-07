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
        "flex items-center justify-between p-2 rounded-ds-lg bg-ds-surface-elevated/40 hover:bg-ds-surface-elevated/80 cursor-pointer transition",
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <MorphIcon icon={icon} size={16} reducedMotion="user" className="text-ds-text-muted" />}
        {dotColorClassName && (
          <span className={cn("h-2.5 w-2.5 rounded-full", dotColorClassName)} />
        )}
        <span className="text-ds-text-primary text-xs">{label}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || loading}
        className="rounded border-ds-border bg-ds-surface text-emerald-500 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  );
}
