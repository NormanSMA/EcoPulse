import type { CSSProperties, ReactNode } from "react";
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

export function MetricCard({ label, value, unit, icon, iconColor, status, compact, className }: MetricCardProps) {
  if (compact) {
    return (
      <div className={cn("flex min-w-0 flex-col gap-1 rounded-ds-card border border-ds-divider bg-white/[0.04] px-3 py-2", className)}>
        <span className="flex items-center gap-1.5">
          {icon && <MorphIcon icon={icon} size={14} reducedMotion="user" className="shrink-0 text-[color:var(--ep-accent)]" style={{ "--ep-accent": iconColor ?? "rgb(var(--ds-primary))" } as CSSProperties} />}
          <span className="text-xl font-semibold leading-6 tabular-nums text-ds-text-primary">{value}</span>
        </span>
        <span className="ds-eyebrow">{label}</span>
      </div>
    );
  }
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-ds-card border border-ds-divider bg-white/[0.04] px-3 py-2", className)}>
      {icon && (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--ep-accent)_15%,transparent)] text-[color:var(--ep-accent)]"
          style={{ "--ep-accent": iconColor ?? "rgb(var(--ds-primary))" } as CSSProperties}
        >
          <MorphIcon icon={icon} size={16} reducedMotion="user" />
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="text-2xl font-semibold leading-7 tabular-nums text-ds-text-primary">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-ds-text-secondary">{unit}</span>}
        </span>
        <span className="ds-eyebrow">{label}</span>
      </div>
      {status && <StatusBadge status={status} size="sm" className="ml-auto" />}
    </div>
  );
}

export interface StatStripProps {
  items: { label: string; value: ReactNode; icon?: IconNode; color?: string }[];
  className?: string;
}

export function StatStrip({ items, className }: StatStripProps) {
  return (
    <dl className={cn("ds-glass flex min-w-0 divide-x divide-ds-divider overflow-x-auto rounded-ds-card py-3", className)}>
      {items.map(({ label, value, icon, color }, index) => (
        <div key={`${label}-${index}`} className="flex flex-1 flex-col gap-1 px-3">
          <dt className="ds-eyebrow break-words">{label}</dt>
          <dd className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums text-ds-text-primary">
            {icon && <MorphIcon icon={icon} size={16} reducedMotion="user" className="shrink-0 text-[color:var(--ep-accent)]" style={{ "--ep-accent": color ?? "rgb(var(--ds-primary))" } as CSSProperties} />}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
