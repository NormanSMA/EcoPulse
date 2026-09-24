import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { StatusBadge, type SimpleStatus } from "@/components/ui/StatusBadge";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: IconNode;
  /** Color del icono (hex de tokens/colors.ts). */
  iconColor?: string;
  status?: SimpleStatus;
  /** Vertical y estrecho (tres métricas en fila en un panel de 340 px). */
  compact?: boolean;
  className?: string;
}

/** Métrica compacta: icono + valor grande + etiqueta, en chip tonal. */
export function MetricCard({ label, value, unit, icon, iconColor, status, compact, className }: MetricCardProps) {
  if (compact) {
    return (
      <div className={cn("flex min-w-0 flex-col gap-1 rounded-ds-2xl bg-ds-surface-container px-3 py-2", className)}>
        <span className="flex items-center gap-1.5">
          {icon && <MorphIcon icon={icon} size={14} reducedMotion="user" style={iconColor ? { color: iconColor } : undefined} />}
          <span className="text-base font-medium leading-5 tabular-nums text-ds-text-primary">{value}</span>
        </span>
        <span className="line-clamp-2 text-[11px] leading-[14px] text-ds-text-secondary">{label}</span>
      </div>
    );
  }
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-ds-2xl bg-ds-surface-container px-3 py-2", className)}>
      {icon && (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-ds-full"
          style={iconColor ? { color: iconColor, backgroundColor: `${iconColor}26` } : undefined}
        >
          <MorphIcon icon={icon} size={16} reducedMotion="user" />
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-base font-medium leading-5 tabular-nums text-ds-text-primary">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-ds-text-secondary">{unit}</span>}
        </span>
        <span className="line-clamp-2 text-xs leading-4 text-ds-text-secondary">{label}</span>
      </div>
      {status && <StatusBadge status={status} size="sm" className="ml-auto" />}
    </div>
  );
}
