import { cn } from "@/design-system/utils/cn";
import { StatusBadge, type SimpleStatus } from "@/components/ui/StatusBadge";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: SimpleStatus;
  className?: string;
}

export function MetricCard({ label, value, unit, status, className }: MetricCardProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex flex-col">
        <span className="text-ds-text-secondary text-[11px] leading-tight">{label}</span>
        <span className="font-semibold text-ds-text-primary text-sm leading-tight">
          {value}
          {unit && <span className="text-ds-text-secondary font-normal ml-1">{unit}</span>}
        </span>
      </div>
      {status && <StatusBadge status={status} size="sm" />}
    </div>
  );
}
