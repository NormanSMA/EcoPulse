import { useTranslations } from "next-intl";
import { cn } from "@/design-system/utils/cn";

// Nombres simples de frescura de UI, desacoplados a propósito de cualquier
// campo de las 8 fuentes de datos reales — ver design-system/hooks/useFreshness.ts.
export type SimpleStatus = "live" | "recent" | "stale" | "unknown";

export interface StatusBadgeProps {
  status: SimpleStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_STYLES: Record<SimpleStatus, { dot: string; text: string }> = {
  live: { dot: "bg-ds-status-live [--ep-accent:rgb(var(--ds-status-live))]", text: "text-ds-status-live" },
  recent: { dot: "bg-ds-status-recent [--ep-accent:rgb(var(--ds-status-recent))]", text: "text-ds-status-recent" },
  stale: { dot: "bg-ds-status-stale [--ep-accent:rgb(var(--ds-status-stale))]", text: "text-ds-status-stale" },
  unknown: { dot: "bg-ds-status-unknown [--ep-accent:rgb(var(--ds-status-unknown))]", text: "text-ds-text-muted" },
};

export function StatusBadge({ status, label, size = "md", className }: StatusBadgeProps) {
  const t = useTranslations("status");
  const { dot, text } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium",
        size === "sm" ? "text-[11px] leading-5" : "text-xs leading-6",
        text,
        className
      )}
    >
      <span aria-hidden="true" className={cn("ds-glow h-1.5 w-1.5 rounded-full", dot)} />
      {label ?? t(status)}
    </span>
  );
}
