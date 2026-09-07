import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { StatusBadge, type SimpleStatus } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

export interface EventListItem {
  id: string;
  icon: IconNode;
  iconClassName?: string;
  title: string;
  description: string;
  timestamp: string;
  status: SimpleStatus;
  onClick?: () => void;
}

export interface EventListProps {
  items: EventListItem[];
  emptyIcon?: IconNode;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
}

/**
 * Lista de eventos recientes (sismos, incendios, desastres...) al estilo
 * Vexto: estado, timestamp y descripción por fila. Presentacional — recibe
 * los items ya combinados y ordenados por quien la use (ver page.tsx).
 */
export function EventList({ items, emptyIcon, emptyTitle, emptyDescription, className }: EventListProps) {
  if (items.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className={cn("flex flex-col gap-1.5 overflow-y-auto", className)}>
      {items.map((item) => (
        <li
          key={item.id}
          onClick={item.onClick}
          className={cn(
            "flex items-start gap-2.5 p-2.5 rounded-ds-lg bg-ds-surface-elevated/60 hover:bg-ds-surface-elevated transition-colors",
            item.onClick && "cursor-pointer"
          )}
        >
          <MorphIcon
            icon={item.icon}
            size={16}
            reducedMotion="user"
            className={cn("shrink-0 mt-0.5", item.iconClassName ?? "text-ds-text-muted")}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ds-text-primary truncate">{item.title}</p>
              <StatusBadge status={item.status} size="sm" />
            </div>
            <p className="text-[11px] text-ds-text-secondary truncate">{item.description}</p>
            <p className="text-[10px] text-ds-text-muted mt-0.5">{item.timestamp}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
