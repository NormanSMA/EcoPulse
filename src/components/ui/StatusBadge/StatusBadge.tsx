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

const STATUS_STYLES: Record<SimpleStatus, { dot: string; text: string; bg: string }> = {
  live: { dot: "bg-ds-status-live", text: "text-ds-status-live", bg: "bg-ds-status-live/10 border-ds-status-live/30" },
  recent: { dot: "bg-ds-status-recent", text: "text-ds-status-recent", bg: "bg-ds-status-recent/10 border-ds-status-recent/30" },
  stale: { dot: "bg-ds-status-stale", text: "text-ds-status-stale", bg: "bg-ds-status-stale/10 border-ds-status-stale/30" },
  unknown: { dot: "bg-ds-status-unknown", text: "text-ds-status-unknown", bg: "bg-ds-status-unknown/10 border-ds-status-unknown/30" },
};

/** Chip de estado (pill con punto), como los tags "Operational" de Weather Lab. */
export function StatusBadge({ status, label, size = "md", className }: StatusBadgeProps) {
  const t = useTranslations("status");
  const { dot, text, bg } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-ds-full border font-medium",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        text,
        bg,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, status === "live" && "animate-pulse")} />
      {label ?? t(status)}
    </span>
  );
}
