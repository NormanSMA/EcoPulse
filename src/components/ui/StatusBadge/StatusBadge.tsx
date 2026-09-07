import { useTranslations } from "next-intl";
import { cn } from "@/design-system/utils/cn";

// Nombres simples de frescura de UI, desacoplados a propósito de cualquier
// campo de las 8 fuentes de datos reales (ninguna tiene hoy este campo en
// src/lib/types.ts) — ver design-system/hooks/useFreshness.ts para cómo se
// deriva a partir de timestamps existentes, sin tocar ingest.ts ni Supabase.
export type SimpleStatus = "live" | "recent" | "stale" | "unknown";

export interface StatusBadgeProps {
  status: SimpleStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_STYLES: Record<SimpleStatus, { dot: string; text: string }> = {
  live: { dot: "bg-emerald-400", text: "text-emerald-400" },
  recent: { dot: "bg-sky-400", text: "text-sky-400" },
  stale: { dot: "bg-amber-400", text: "text-amber-400" },
  unknown: { dot: "bg-slate-500", text: "text-slate-400" },
};

export function StatusBadge({ status, label, size = "md", className }: StatusBadgeProps) {
  const t = useTranslations("status");
  const { dot, text } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        text,
        "bg-current/10",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label ?? t(status)}
    </span>
  );
}
